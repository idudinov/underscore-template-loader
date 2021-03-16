/* This loader returns the filename if no loader takes care of the file */

import type Webpack from 'webpack';
import * as LoaderUtils from 'loader-utils';

module.exports = function (this: Webpack.loader.LoaderContext, source: string) {
  if (this.cacheable) {
    this.cacheable();
  }
  const query = this.query instanceof Object ? this.query : LoaderUtils.parseQuery(this.query);

  const allLoadersButThisOne = this.loaders.filter(loader => {
    return loader.module !== module.exports;
  });

  // This loader shouldn't kick in if there is any other loader
  if (allLoadersButThisOne.length > 0) {
    return source;
  }

  return 'module.exports = ' + JSON.stringify(query.url);
};
