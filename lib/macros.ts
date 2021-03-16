import * as LoaderUtils from 'loader-utils';

const strRepeat = (str, times) => {
    let result = '';

    for (var i = 0; i < times; i++) {
        result += str;
    }

    return result;
};

// Used to translate require macros to override arguments
var objExtend = function (args, obj) {args = Array.prototype.slice.call(args);var _a = args.slice(1); _a.unshift(Object.assign(obj, args[0])); return _a;};

// Default macros
export default {
    require: function (resourcePath, args) {
      var argsExpr = args ? '(' + objExtend + ')' + '(arguments, ' + JSON.stringify(args) + ')' : 'arguments';
      return "require(" + JSON.stringify(LoaderUtils.urlToRequest(resourcePath)) + ").apply(null," + argsExpr + ")";
    },

    include: function (resourcePath) {
        return "require(" + JSON.stringify(LoaderUtils.urlToRequest(resourcePath)) + ")";
    },

    br: function (times) {
        var str = strRepeat('<br>', typeof(times) == 'undefined' ? 1 : parseInt(times));
        return "'" + str + "'";
    },

    nl: function (times) {
        var str = strRepeat('\\n', typeof(times) == 'undefined' ? 1 : parseInt(times));
        return "'" + str + "'";
    }
};
