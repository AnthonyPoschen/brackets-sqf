/* Hinter file for working out what to hint to autocomplete */
define(function (require, exports, module) {
    'use strict';

    var AppInit             = brackets.getModule("utils/AppInit"),
    LanguageManager         = brackets.getModule("language/LanguageManager"),
    FileSystem              = brackets.getModule("filesystem/FileSystem"),
    FileUtils               = brackets.getModule("file/FileUtils"),
    TokenUtils              = brackets.getModule("utils/TokenUtils"),
    ProjectManager          = brackets.getModule("project/ProjectManager"),
    CodeHintManager         = brackets.getModule("editor/CodeHintManager");
    
    CodeMirror.defineMode("sqf", function(config) {
        var indentUnit = config.indentUnit;
        
        function getTokenToCursor(token) {
            var tokenStart = token.token.start,
                tokenCursor = token.pos.ch,
                tokenString = token.token.string;
            return tokenString.substr(0, (tokenCursor - tokenStart));
        }   
        
        var keywords = {
            "break": true,
            "case": true,
            "continue": true,
            "default": true,
            "else": true,
            "for": true,
            "if": true,
            "return": true,
            "select": true,
            "switch": true
        };
        var atoms = {};
        atoms = require('text!atoms.json');
        atoms = JSON.parse(atoms);

        // Hint start
        var hintwords = [];
        for(var i in atoms){
            hintwords.push(i);
        }
        for(var i in keywords){
            hintwords.push(i);
        }
        function SQFHints() {
            this.activeToken = "";
            this.lastToken = "";
            this.cachedsqfKeywords = [];
        }
        
        // look to see if hints are available.
        SQFHints.prototype.hasHints = function (editor , implicitChar) {
            this.editor = editor;
            var i = 0,
                cursor = editor.getCursorPos(),
                tokenToCursor = "";
            
            this.activeToken = TokenUtils.getInitialContext(editor._codeMirror, cursor);
            
            tokenToCursor = getTokenToCursor(this.activeToken);
            
            // if string length > 1. or explicit request
            if(this.activeToken.token.string.length > 1 || implicitChar=== null) {
                
                for(i = 0; i < this.cachedsqfKeywords.length; ++i) {
                    if(this.cachedsqfKeywords[i].indexOf(tokenToCursor) === 0) {
                        return true;
                    }
                }
            }
            // no hints found
            return false;
            
        };
        
        SQFHints.prototype.getHints = function(implicitChar) {
            var i = 0,
                hintlist = [],
                sqfkeywordlist = [],
                $fhint,
                cursor = this.editor.getCursorPos(),
                tokenToCursor = "";
            
            this.activeToken = TokenUtils.getInitialContext(this.editor._codeMirror,cursor);
            tokenToCursor = getTokenToCursor(this.activeToken);
            for(i = 0; i < this.cachedsqfKeywords.length; ++i){
                if(this.cachedsqfKeywords[i].toUpperCase().indexOf(tokenToCursor.toUpperCase()) === 0 ) {
                    $fhint = $("<span>")
                        .text(this.cachedsqfKeywords[i]);
                    hintlist.push($fhint);
                    var poo = ($fhint[0]);
                    //console.log(($($fhint[0]))[0].outerText.length);
                    //console.log((poo.toString()).length);
                }
            }
            hintlist.sort(function(a,b){return (($(a[0]))[0].outerText.length - ($(b[0]))[0].outerText.length);});
            return {
                hints: hintlist,
                match: false,
                selectInitial: true,
                handleWideResults: false
            };
        };
        SQFHints.prototype.insertHint = function($hint) {
          var   cursor = this.editor.getCursorPos(),
                currentToken        = this.editor._codeMirror.getTokenAt(cursor),
                replaceStart        = {line: cursor.line, ch: currentToken.start},
                replaceEnd          = {line: cursor.line, ch: cursor.ch};
            this.editor.document.replaceRange($hint.text(), replaceStart, replaceEnd);
            return false;
        };
        var sqfHints = new SQFHints();
        // hint end
        AppInit.appReady(function () {
            CodeHintManager.registerHintProvider(sqfHints,["sqf"],10);
            sqfHints.cachedsqfKeywords = hintwords;
        });
        var isOperatorChar = /[+\-*&^%:=<>!|\/]/;
        var curPunc;

        function tokenBase(stream, state) {
            var ch = stream.next();
            if (ch == '"' || ch == "'" || ch == "`") {
                state.tokenize = tokenString(ch);
                return state.tokenize(stream, state);
            }
            if (/[\d\.]/.test(ch)) {
                if (ch == ".") {
                    stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
                } else if (ch == "0") {
                    stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
                } else {
                    stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
                }
                return "number";
            }
            if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
                curPunc = ch;
                return null;
            }
            if (ch == "/") {
                if (stream.eat("*")) {
                    state.tokenize = tokenComment;
                    return tokenComment(stream, state);
                }
                if (stream.eat("/")) {
                    stream.skipToEnd();
                    return "comment";
                }
            }
            if (isOperatorChar.test(ch)) {
                stream.eatWhile(isOperatorChar);
                return "operator";
            }
            stream.eatWhile(/[\w\$_]/);
            var cur = stream.current();
            if (keywords.propertyIsEnumerable(cur)) {
                if (cur == "case" || cur == "default") curPunc = "case";
                return "keyword";
            }
            if (atoms.propertyIsEnumerable(cur)) return "atom";
                return "variable";
            }

            function tokenString(quote) {
                return function(stream, state) {
                    var escaped = false,
                    next, end = false;
            while ((next = stream.next()) != null) {
                if (next == quote && !escaped) {
                    end = true;
                    break;
                }
                escaped = !escaped && next == "\\";
            }
            if (end || !(escaped || quote == "`")) state.tokenize = tokenBase;
            return "string";
            };
        }

        function tokenComment(stream, state) {
            var maybeEnd = false,
            ch;
            while (ch = stream.next()) {
                if (ch == "/" && maybeEnd) {
                    state.tokenize = tokenBase;
                    break;
                }
                maybeEnd = (ch == "*");
            }
            return "comment";
        }

        function Context(indented, column, type, align, prev) {
            this.indented = indented;
            this.column = column;
            this.type = type;
            this.align = align;
            this.prev = prev;
        }

        function pushContext(state, col, type) {
            return state.context = new Context(state.indented, col, type, null, state.context);
        }

        function popContext(state) {
            var t = state.context.type;
            if (t == ")" || t == "]" || t == "}") state.indented = state.context.indented;
            return state.context = state.context.prev;
        }

        // Interface
        return {
            startState: function(basecolumn) {
                return {
                    tokenize: null,
                    context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
                    indented: 0,
                    startOfLine: true
                };
            },

            token: function(stream, state) {
                var ctx = state.context;
                if (stream.sol()) {
                    if (ctx.align == null) ctx.align = false;
                    state.indented = stream.indentation();
                    state.startOfLine = true;
                    if (ctx.type == "case") ctx.type = "}";
                }
                if (stream.eatSpace()) return null;
                curPunc = null;
                var style = (state.tokenize || tokenBase)(stream, state);
                if (style == "comment") return style;
                if (ctx.align == null) ctx.align = true;

                if (curPunc == "{") pushContext(state, stream.column(), "}");
                else if (curPunc == "[") pushContext(state, stream.column(), "]");
                else if (curPunc == "(") pushContext(state, stream.column(), ")");
                else if (curPunc == "case") ctx.type = "case";
                else if (curPunc == "}" && ctx.type == "}") ctx = popContext(state);
                else if (curPunc == ctx.type) popContext(state);
                state.startOfLine = false;
                return style;
            },

            indent: function(state, textAfter) {
                if (state.tokenize != tokenBase && state.tokenize != null) return 0;
                var ctx = state.context,
                firstChar = textAfter && textAfter.charAt(0);
                if (ctx.type == "case" && /^(?:case|default)\b/.test(textAfter)) {
                    state.context.type = "}";
                    return ctx.indented;
                }
                var closing = firstChar == ctx.type;
                if (ctx.align) return ctx.column + (closing ? 0 : 1);
                else return ctx.indented + (closing ? 0 : indentUnit);
            },

                electricChars: "{}:",
                blockCommentStart: "/*",
                blockCommentEnd: "*/",
                lineComment: "//"
        };
    });

    CodeMirror.defineMIME("text/x-sqf", "sqf");

    LanguageManager.defineLanguage("sqf", {
        name: "sqf",
        mode: "sqf",
        fileExtensions: ["sqf"],
        blockComment: ["/*","*/"],
        lineComment: ["//","//"]
    });
    
});
