import {
  isFunction,
  assign,
  find,
  forEach
} from 'lodash';

import { writeFileSync } from 'fs';

import CmofParser from 'cmof-parser';


function Builder() {

  var desc;

  var hooks = {
    'preSerialize': []
  };

  function getPackage() {
    var elementsById = desc.byId;
    return elementsById['_0'];
  }

  function findProperty(properties, name) {
    var property = find(properties, function(d) {
      return d.name === name;
    });

    return property && {
      property: property,
      idx: properties.indexOf(property)
    };
  }

  function reorderProperties(desc, propertyNames) {
    var properties = desc.properties;

    var last;

    forEach(propertyNames, function(name) {

      var descriptor = findProperty(properties, name);

      if (!descriptor) {
        throw new Error('property <' + name + '> does not exist');
      }

      if (last) {
        // remove from old position
        properties.splice(descriptor.idx, 1);

        // update descriptor position
        descriptor.idx = last.idx + 1;

        // add at new position
        properties.splice(descriptor.idx, 0, descriptor.property);
      }

      last = descriptor;
    });
  }

  function swapProperties(desc, prop1, prop2) {
    var props = desc.properties;

    function findProperty(name) {
      return find(props, function(d) {
        return d.name === name;
      });
    }

    var p1 = findProperty(prop1);
    var p2 = findProperty(prop2);

    var idx1 = props.indexOf(p1);
    var idx2 = props.indexOf(p2);

    props[idx1] = p2;
    props[idx2] = p1;
  }

  function exportTo(file) {

    var pkg = getPackage();

    var str = JSON.stringify(pkg, null, '  ');

    forEach(hooks.preSerialize, function(fn) {
      str = fn(str);
    });

    writeFileSync(file, str);
  }

  function preSerialize(fn) {
    hooks.preSerialize.push(fn);
  }

  function rename(oldType, newType) {
    preSerialize(function(str) {
      return str.replace(new RegExp(oldType, 'g'), newType);
    });
  }

  function alter(elementName, extension) {

    var elementParts = elementName.split('#');

    var elementsById = desc.byId;

    var element = elementsById[elementParts[0]];

    if (!element) {
      throw new Error('[transform] element <' + elementParts[0] + '> does not exist');
    }

    if (elementParts[1]) {
      var property = find(element.properties, function(p) {
        return p.name === elementParts[1];
      });

      if (!property) {
        throw new Error('[transform] property <' + elementParts[0] + '#' + elementParts[1] + '> does not exist');
      }

      if (isFunction(extension)) {
        extension.call(element, property);
      } else {
        assign(property, extension);
      }
    } else {
      if (isFunction(extension)) {
        extension.call(element, element);
      } else {
        assign(element, extension);
      }
    }
  }

  function cleanIDs() {

    preSerialize(function(str) {

      // remove "id": "Something" lines
      return str.replace(/,\n\s+"id": "[^"]+"/g, '');
    });
  }

  function cleanAssociations() {

    preSerialize(function(str) {

      // remove "association": "Something" lines
      return str.replace(/,\n\s+"association": "[^"]+"/g, '');
    });
  }

  function parse(file, postParse, done) {

    new CmofParser({ clean: true }).parseFile(file, function(err, _desc) {
      if (err) {
        done(err);
      } else {
        desc = _desc;

        try {
          postParse(getPackage(), desc);
          done(null);
        } catch (e) {
          done(e);
        }
      }
    });
  }

  this.parse = parse;
  this.alter = alter;
  this.rename = rename;
  this.reorderProperties = reorderProperties;
  this.swapProperties = swapProperties;

  this.cleanIDs = cleanIDs;
  this.cleanAssociations = cleanAssociations;

  this.exportTo = exportTo;
}

module.exports = Builder;