import Path from 'path';
import * as LoaderUtils from 'loader-utils';
import { parseAttributes } from './lib/attributeParser';
import { parseMacro, MacroContext } from './lib/macroParser';
import type Webpack from 'webpack';
import DefaultMacros from './lib/macros';

import _ from 'underscore';

// Extendable arguments
const macros = _.extend({}, DefaultMacros);

exports = function(this: Webpack.loader.LoaderContext, content) {
  this.cacheable && this.cacheable();
  const callback = this.async();

  // Default arguments
  let root,
      parseMacros = true,
      engine = false as false | string,
      withImports = false,
      attributes = ['img:src'],
      parseDynamicRoutes = false;

  // Parse arguments
  var query = this.query instanceof Object ? this.query : LoaderUtils.parseQuery(this.query);

  if (_.isObject(query)) {
    root = query.root;

    // Apply template settings
    _.each(_.pick(query, 'interpolate', 'escape', 'evaluate'), function(value, key) {
      _.templateSettings[key] = new RegExp(value, 'g');
    });

    // Apply template variable
    if (query.variable !== undefined) {
      _.templateSettings.variable = query.variable;
    }

    // Set tag+attribute to parse for external resources
    if (query.attributes !== undefined) {
      attributes = _.isArray(query.attributes) ? query.attributes : [];
    }

    // Parse / ignore macros
    if (query.parseMacros !== undefined) {
      parseMacros = !!query.parseMacros;
    }

    // Template engine
    if (query.engine !== undefined) {
      engine = query.engine;
    }

    // Template settings imports (on by default for lodash)
    if (query.withImports !== undefined) {
      withImports = query.withImports;
    } else if (engine === 'lodash') {
      withImports = true;
    }

    // Prepend a html comment with the filename in it
    if (query.prependFilenameComment) {
      var filenameRelative = Path.relative(query.prependFilenameComment, this.resource);
      content = "\n<!-- " + filenameRelative + " -->\n" + content;
    }

    // Check if dynamic routes must be parsed
    if (query.parseDynamicRoutes !== undefined) {
      parseDynamicRoutes = !!query.parseDynamicRoutes;
    }

    // support macros in loader options. because it isn't support customer options from webpack@4
    if (_.isObject(query.macros)) {
      _.extend(macros, query.macros);
    }
  }

  // Include additional macros
  if (_.isObject(this.query.macros)) {
    _.extend(macros, this.query.macros);
  }

  // Parse macros
  let macrosContext: MacroContext;
  if (parseMacros) {
    macrosContext = parseMacro(content, function (macro) {
      return _.isFunction(macros[macro]);
    }, 'MACRO');
    content = macrosContext.replaceMatches(content);
  }

  // Parse attributes
  const attributesContext = parseAttributes(content, function (tag, attr) {
    return attributes.indexOf(tag + ':' + attr) != -1;
  }, 'ATTRIBUTE', root, parseDynamicRoutes);
  content = attributesContext.replaceMatches(content);

  // Compile template
  let source = _.template(content).source;

  // Resolve macros
  if (parseMacros) {
    source = macrosContext.resolveMacros(source, macros);
  }

  // Resolve attributes
  source = attributesContext.resolveAttributes(source);

  // Build the module export, optionally with template imports
  if (withImports) {
    source = 'module.exports = Function(_.keys(_.templateSettings.imports), \'return \' + ' + source + '.toString()).apply(undefined, _.values(_.templateSettings.imports));\n';
  } else {
    source = 'module.exports = ' + source + ';\n';
  }

  // Explicitly require the engine, otherwise it will rely on the global _
  if (engine) {
    source = 'var _ = require(\'' + engine + '\');\n' + source;
  }

  callback(null, source);
};

