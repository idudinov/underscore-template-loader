import * as Parser from 'fastparse';

// Macro class
class Macro {

    start: number;
    args = [];

    constructor(readonly name, index: number, readonly length) {
        this.start = index;
    }

    getArguments() {
        return this.args.map(arg => arg.value);
    }

}

class MacroContext {
    currentMacro = null;
    matches = [];
    data = {};

    constructor(readonly isMacroAvailable, readonly usid) {
    }

    ident() {
        return "____" + this.usid + Math.random() + "____";
    }

    replaceMatches(content: string) {
        const parts = [content];
        this.matches.reverse();

        this.matches.forEach((match) => {
            let ident;
            do {
                ident = this.ident();
            } while (this.data[ident]);

            this.data[ident] = match;

            const x = parts.pop();
            parts.push(x.substr(match.start + match.length));
            parts.push(ident);
            parts.push(x.substr(0, match.start));
        });

        parts.reverse();
        return parts.join('');
    }

    resolveMacros(content, macros) {
        var regex = new RegExp('____' + this.usid + '[0-9\\.]+____', 'g');
        var self = this;

        // Replace macro expressions
        content = content.replace(regex, function (match) {
            if (!self.data[match]) {
                return match;
            }

            var macro = self.data[match];
            return "' + " +  macros[macro.name].apply(null, macro.getArguments()) + " + '";
        });

        // Replace escaped macros
        content = content.replace(/\\+(@\w+)/, function (match, expr) {
            return expr;
        });

        return content;
    };

};



// Parses a macro string argument
var processStringArg = function (match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: value
    });
};

// Parses a macro numeric argument
var processNumArg = function (match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: parseFloat(value)
    });
};

// Parses a macro boolean argument
var processBooleanArg = function (match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: value === 'true'
    });
};

var processObjectArg = function (match, value, index, length) {
  if (!this.currentMacro) return;
  this.currentMacro.args.push({
    start: index + value.length,
    index: index,
    length: length,
    value: JSON.parse(value)
  });
};

// Parser configuration
var specs = {
    outside: {
        "^@(\\w+)\\(|([^\\\\])@(\\w+)\\(": function (match, name, prefix, _name, index, length) {
            var name = name || _name;

            if (!this.isMacroAvailable(name)) {
                this.currentMacro = null;
                return 'inside';
            }

            var macro = new Macro(name, prefix ? index + 1 : index, length);
            this.matches.push(macro);
            this.currentMacro = macro;
            return 'inside';
        }
    },

    inside: {
        "\\)": function (match, index) {
            if (this.currentMacro !== null) {
                this.currentMacro.length = 1 + index - this.currentMacro.start;
            }
            return 'outside';
        },
        "\'([^\']*)\'": processStringArg,
        "\"([^\"]*)\"": processStringArg,
        "\\s*([\\d|\\.]+)\\s*": processNumArg,
        "\\s*(true|false)\\s*": processBooleanArg,
        "\\s*({.+})\\s*": processObjectArg,
        "\\s+": true
    }
};

var parser = new Parser(specs);

module.exports = function parse(html, isMacroAvailable, usid) {
    var context = new MacroContext(isMacroAvailable, usid);
    return parser.parse('outside', html, context);
};
