import Parser from 'fastparse';

class Macro {

    start: number;
    args = [];

    constructor(readonly name, index: number, public length) {
        this.start = index;
    }

    getArguments() {
        return this.args.map(arg => arg.value);
    }

}

export class MacroContext {
    currentMacro: Macro = null;
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

    resolveMacros(content: string, macros) {
        const regex = new RegExp('____' + this.usid + '[0-9\\.]+____', 'g');

        // Replace macro expressions
        content = content.replace(regex, (match) => {
            if (!this.data[match]) {
                return match;
            }

            const macro = this.data[match];
            return "' + " +  macros[macro.name].apply(null, macro.getArguments()) + " + '";
        });

        // Replace escaped macros
        content = content.replace(/\\+(@\w+)/, (match, expr) => {
            return expr;
        });

        return content;
    };

};



// Parses a macro string argument
const processStringArg = function (this: MacroContext, match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: value
    });
};

// Parses a macro numeric argument
const processNumArg = function (this: MacroContext, match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: parseFloat(value)
    });
};

// Parses a macro boolean argument
const processBooleanArg = function (this: MacroContext, match, value, index, length) {
    if (!this.currentMacro) return;
    this.currentMacro.args.push({
        start: index + value.length,
        index: index,
        length: length,
        value: value === 'true'
    });
};

const processObjectArg = function (this: MacroContext, match, value, index, length) {
  if (!this.currentMacro) return;
  this.currentMacro.args.push({
    start: index + value.length,
    index: index,
    length: length,
    value: JSON.parse(value)
  });
};

// Parser configuration
const specs = {
    outside: {
        "^@(\\w+)\\(|([^\\\\])@(\\w+)\\(": function (this: MacroContext, match, name, prefix, _name, index, length) {
            name = name || _name;

            if (!this.isMacroAvailable(name)) {
                this.currentMacro = null;
                return 'inside';
            }

            const macro = new Macro(name, prefix ? index + 1 : index, length);
            this.matches.push(macro);
            this.currentMacro = macro;
            return 'inside';
        }
    },

    inside: {
        "\\)": function (this: MacroContext, match, index) {
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

const parser = new Parser<MacroContext>(specs);

export function parseMacro(html, isMacroAvailable, usid) {
    const context = new MacroContext(isMacroAvailable, usid);
    return parser.parse('outside', html, context);
};
