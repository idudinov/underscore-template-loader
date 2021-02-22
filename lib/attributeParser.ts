import * as Path from 'path';
import * as Url from 'url';
import * as Parser from 'fastparse';
import * as LoaderUtils from 'loader-utils';

import _ from 'underscore';

// Reminder: path.isAbsolute is not available in 0.10.x
function pathIsAbsolute(attrValue: string) {
    return Path.resolve(attrValue) == Path.normalize(attrValue);
};

// Checks whether a string contains a template expression
const isTemplate = function (content: string) {
    // Test against regex list
    var interpolateTest = _.templateSettings.interpolate.test(content);

    if (interpolateTest) {
        _.templateSettings.interpolate.lastIndex = 0;
        return true;
    }

    const evaluateTest = _.templateSettings.evaluate.test(content);

    if (evaluateTest) {
        _.templateSettings.evaluate.lastIndex = 0;
        return true;
    }

    const escapeTest = _.templateSettings.escape.test(content);
    _.templateSettings.escape.lastIndex = 0;
    return escapeTest;
};

class AttributeContext {
    currentDirective = null;
    matches = [];
    data = {};

    currentTag = undefined;

    constructor(
        readonly isRelevantTagAttr,
        readonly usid,
        readonly root,
        readonly parseDynamicRoutes,
    ) {
    }

    ident() {
        return "____" + this.usid + Math.random() + "____";
    };

    replaceMatches(content: string) {
        const parts = [content];
        this.matches.reverse();

        this.matches.forEach(function (match) {
            if (isTemplate(match.value)) {
                // Replace attribute value
                // This is used if it contains a template expression and both the "root" and "parseDynamicRoutes"
                // were defined
                if (pathIsAbsolute(match.value) && this.root !== undefined) {
                    const x = parts.pop();
                    parts.push(x.substr(match.start + match.length));
                    parts.push(match.expression);
                    parts.push(x.substr(0, match.start));
                }
            } else {
                // Ignore if path is absolute and no root path has been defined
                if (pathIsAbsolute(match.value) && this.root === undefined) {
                    return;
                }

                // Ignore if is a URL
                if (!LoaderUtils.isUrlRequest(match.value, this.root)) {
                    return;
                }

                const uri = new Url.URL(match.value);
                if (uri.hash !== null && uri.hash !== undefined) {
                    uri.hash = null;
                    match.value = uri.href;
                    match.length = match.value.length;
                }

                let ident;
                do {
                    ident = this.ident();
                } while (this.data[ident]);

                this.data[ident] = match;

                const x = parts.pop();
                parts.push(x.substr(match.start + match.length));
                parts.push(ident);
                parts.push(x.substr(0, match.start));
            }
        });

        parts.reverse();
        return parts.join('');
    }

    resolveAttributes(content: string) {
        const regex = new RegExp('____' + this.usid + '[0-9\\.]+____', 'g');

        return content.replace(regex, (match) => {
            if (!this.data[match]) {
                return match;
            }

            const url = this.data[match].value;

            // Make resource available through file-loader
            const fallbackLoader = require.resolve('../file-loader.js') + '?url=' + encodeURIComponent(url);
            return "' + require(" + JSON.stringify(fallbackLoader + '!' + LoaderUtils.urlToRequest(url, this.root)) + ") + '";
        });
    }
}

// Process a tag attribute
const processMatch = function (this: AttributeContext, match, strUntilValue, name, value, index) {
    var self = this;
    var expression = value;

    if (!this.isRelevantTagAttr(this.currentTag, name)) {
        return;
    }

    // Try and set "root" directory when a dynamic attribute is found
    if (isTemplate(value)) {
        if (pathIsAbsolute(value) && self.root !== undefined && self.parseDynamicRoutes) {
            // Generate new value for replacement
            expression = LoaderUtils.urlToRequest(value, self.root);
        }
    }

    this.matches.push({
        start: index + strUntilValue.length,
        length: value.length,
        value: value,
        expression: expression
    });
};

// Parser configuration
var specs = {
    outside: {
        "<!--.*?-->": true,
        "<![CDATA[.*?]]>": true,
        "<[!\\?].*?>": true,
        "<\/[^>]+>": true,
        "<([a-zA-Z\\-:]+)\\s*": function (match, tagName) {
            this.currentTag = tagName;
            return 'inside';
        }
    },

    inside: {
        "\\s+": true,   // Eat up whitespace
        ">": 'outside', // End of attributes
        "(([a-zA-Z\\-]+)\\s*=\\s*\")([^\"]*)\"": processMatch,
        "(([a-zA-Z\\-]+)\\s*=\\s*\')([^\']*)\'": processMatch,
        "(([a-zA-Z\\-]+)\\s*=\\s*)([^\\s>]+)": processMatch
    }
};

var parser = new Parser(specs);

export function parseAttributes(html, isRelevantTagAttr, usid, root, parseDynamicRoutes) {
    var context = new AttributeContext(isRelevantTagAttr, usid, root, parseDynamicRoutes);
    return parser.parse('outside', html, context);
};
