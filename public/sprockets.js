/*  Prototype JavaScript framework, version 1.7_rc3
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {

  Version: '1.7_rc3',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img'),
        matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator) {
    for (var i = 0, length = this.length; i < length; i++)
      iterator(this[i]);
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values))
          return results.concat(values.map(toQueryPair.curry(key)));
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params) {
      if (this.method == 'get')
        this.url += (this.url.include('?') ? '&' : '?') + params;
      else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent))
        params += '&_=';
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300);
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});


function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();

    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (SELECT_ELEMENT_INNERHTML_BUGGY || TABLE_ELEMENT_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];
  if (t) {
    div.innerHTML = t[0] + html + t[1];
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
		soFar = selector;

	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];

		parts.push( m[1] );

		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] )
					selector += parts.shift();

				set = posProcess( selector, set );
			}
		}
	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		throw "Syntax error, unrecognized expression: " + (cur || selector);
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;

		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.match[ type ].exec( expr )) != null ) {
				var filter = Expr.filter[ type ], found, item;
				anyFound = false;

				if ( curLoop == result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		if ( expr == old ) {
			if ( anyFound == null ) {
				throw "Syntax error, unrecognized expression: " + expr;
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag && !isXML ) {
				part = part.toUpperCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = isXML ? part : part.toUpperCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context, isXML){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
						if ( !inplace )
							result.push( elem );
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			for ( var i = 0; curLoop[i] === false; i++ ){}
			return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
		},
		CHILD: function(match){
			if ( match[1] == "nth" ) {
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");

			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}

			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 == i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 == i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					if ( type == 'first') return true;
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first == 1 && last == 0 ) {
						return true;
					}

					var doneName = match[0],
						parent = elem.parentNode;

					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						}
						parent.sizcache = doneName;
					}

					var diff = elem.nodeIndex - last;
					if ( first == 0 ) {
						return diff == 0;
					} else {
						return ( diff % first == 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value != check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}

	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	if ( !!document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){

	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
	var oldSizzle = Sizzle, div = document.createElement("div");
	div.innerHTML = "<p class='TEST'></p>";

	if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
		return;
	}

	Sizzle = function(query, context, extra, seed){
		context = context || document;

		if ( !seed && context.nodeType === 9 && !isXML(context) ) {
			try {
				return makeArray( context.querySelectorAll(query), extra );
			} catch(e){}
		}

		return oldSizzle(query, context, extra, seed);
	};

	for ( var prop in oldSizzle ) {
		Sizzle[ prop ] = oldSizzle[ prop ];
	}

	div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
	var div = document.createElement("div");
	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	if ( div.getElementsByClassName("e").length === 0 )
		return;

	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 )
		return;

	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ){
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ) {
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ?  function(a, b){
	return a.compareDocumentPosition(b) & 16;
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
		!!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;
  var IE_LEGACY_EVENT_SYSTEM = (window.attachEvent && !window.addEventListener);

  var _isButton;
  if (IE_LEGACY_EVENT_SYSTEM) {
    var buttonMap = { 0: 1, 1: 4, 2: 2 };
    _isButton = function(event, code) {
      return event.button === buttonMap[code];
    };
  } else if (Prototype.Browser.WebKit) {
    _isButton = function(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
        case 2: return event.which == 3;
        default: return false;
      }
    };
  } else {
    _isButton = function(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    };
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }

  Event.Methods = {
    isLeftClick: isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick: isRightClick,

    element: element,
    findElement: findElement,

    pointer: pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };


  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (IE_LEGACY_EVENT_SYSTEM) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    });

    Event.extend = function(event, element) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;

      event._extendedByPrototype = Prototype.emptyFunction;
      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      return Object.extend(event, methods);
    };
  } else {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
    Event.extend = Prototype.K;
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var responder = responders.find( function(r) { return r.handler === handler; });
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = event.findElement(this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();
(function() {
  Ajax.Responders.register({
    onCreate: function(request) {
      var token = $$('meta[name=csrf-token]')[0];
      if (token) {
        if (!request.options.requestHeaders) request.options.requestHeaders = {};
        request.options.requestHeaders['X-CSRF-Token'] = token.readAttribute('content');
      }
    }
  });

  function isEventSupported(eventName) {
    var el = document.createElement('div');
    eventName = 'on' + eventName;
    var isSupported = (eventName in el);
    if (!isSupported) {
      el.setAttribute(eventName, 'return;');
      isSupported = typeof el[eventName] == 'function';
    }
    el = null;
    return isSupported;
  }

  function isForm(element) {
    return Object.isElement(element) && element.nodeName.toUpperCase() == 'FORM';
  }

  function isInput(element) {
    if (Object.isElement(element)) {
      var name = element.nodeName.toUpperCase();
      return name == 'INPUT' || name == 'SELECT' || name == 'TEXTAREA';
    }
    else return false;
  }

  var submitBubbles = isEventSupported('submit'),
      changeBubbles = isEventSupported('change'),
      emulateFocusin = document.addEventListener &&
        (Prototype.Browser.MobileSafari || !Prototype.Browser.WebKit);

  if (!submitBubbles || !changeBubbles || emulateFocusin) {
    Event.Handler.prototype.initialize = Event.Handler.prototype.initialize.wrap(
      function(init, element, eventName, selector, callback) {
        init(element, eventName, selector, callback);
        if ( (!submitBubbles && this.eventName == 'submit' && !isForm(this.element)) ||
             (!changeBubbles && this.eventName == 'change' && !isInput(this.element)) ||
             (emulateFocusin && (this.eventName == 'focusin' || this.eventName == 'focusout')) ) {
          this.eventName = 'emulated:' + this.eventName;
        }
      }
    );
  }

  if (emulateFocusin) {
    $H({ focus: 'focusin', blur: 'focusout' }).each(function(pair) {
      document.addEventListener(pair.key, function(e) {
        e.target.fire('emulated:' + pair.value, e, true);
      }, true);
    });
  }

  if (!submitBubbles) {
    document.on('focusin', 'form', function(focusEvent, form) {
      if (!form.retrieve('emulated:submit')) {
        form.on('submit', function(submitEvent) {
          var emulated = form.fire('emulated:submit', submitEvent, true);
          if (emulated.returnValue === false) submitEvent.preventDefault();
        });
        form.store('emulated:submit', true);
      }
    });
  }

  if (!changeBubbles) {
    document.on('focusin', 'input, select, textarea', function(focusEvent, input) {
      if (!input.retrieve('emulated:change')) {
        input.on('change', function(changeEvent) {
          input.fire('emulated:change', changeEvent, true);
        });
        input.store('emulated:change', true);
      }
    });
  }

  function handleRemote(element) {
    var method, url, params;

    var event = element.fire("ajax:before");
    if (event.stopped) return false;

    if (element.tagName.toLowerCase() === 'form') {
      method = element.readAttribute('method') || 'post';
      url    = element.readAttribute('action');
      params = element.serialize({ submit: element.retrieve('rails:submit-button') });
      element.store('rails:submit-button', null);
    } else {
      method = element.readAttribute('data-method') || 'get';
      url    = element.readAttribute('href');
      params = {};
    }

    new Ajax.Request(url, {
      method: method,
      parameters: params,
      evalScripts: true,

      onCreate:   function(response) { element.fire("ajax:create",   response); },
      onComplete: function(response) { element.fire("ajax:complete", response); },
      onSuccess:  function(response) { element.fire("ajax:success",  response); },
      onFailure:  function(response) { element.fire("ajax:failure",  response); }
    });

    element.fire("ajax:after");
  }

  function insertHiddenField(form, name, value) {
    form.insert(new Element('input', { type: 'hidden', name: name, value: value }));
  }

  function handleMethod(element) {
    var method = element.readAttribute('data-method'),
        url = element.readAttribute('href'),
        csrf_param = $$('meta[name=csrf-param]')[0],
        csrf_token = $$('meta[name=csrf-token]')[0];

    var form = new Element('form', { method: "POST", action: url, style: "display: none;" });
    $(element.parentNode).insert(form);

    if (method !== 'post') {
      insertHiddenField(form, '_method', method);
    }

    if (csrf_param) {
      insertHiddenField(form, csrf_param.readAttribute('content'), csrf_token.readAttribute('content'));
    }

    form.submit();
  }

  function disableFormElements(form) {
    form.select('input[type=submit][data-disable-with]').each(function(input) {
      input.store('rails:original-value', input.getValue());
      input.setValue(input.readAttribute('data-disable-with')).disable();
    });
  }

  function enableFormElements(form) {
    form.select('input[type=submit][data-disable-with]').each(function(input) {
      input.setValue(input.retrieve('rails:original-value')).enable();
    });
  }

  function allowAction(element) {
    var message = element.readAttribute('data-confirm');
    return !message || confirm(message);
  }

  document.on('click', 'a[data-confirm], a[data-remote], a[data-method]', function(event, link) {
    if (!allowAction(link)) {
      event.stop();
      return false;
    }

    if (link.readAttribute('data-remote')) {
      handleRemote(link);
      event.stop();
    } else if (link.readAttribute('data-method')) {
      handleMethod(link);
      event.stop();
    }
  });

  document.on('pseudo:click', 'a[data-remote]', function(event, link) {
    handleRemote(link);
  });

  document.on("click", "form input[type=submit], form button[type=submit], form button:not([type])", function(event, button) {
    event.findElement('form').store('rails:submit-button', button.name || false);
  });

  document.on("submit", function(event) {
    var form = event.findElement();

    if (!allowAction(form)) {
      event.stop();
      return false;
    }

    if (form.readAttribute('data-remote')) {
      handleRemote(form);
      event.stop();
    } else {
      disableFormElements(form);
    }
  });

  document.on('ajax:create', 'form', function(event, form) {
    if (form == event.findElement()) disableFormElements(form);
  });

  document.on('ajax:complete', 'form', function(event, form) {
    if (form == event.findElement()) enableFormElements(form);
  });
})();
document.on('dom:loaded', function() {
  if (!window.Modernizr) return

  if (!Modernizr.input.placeholder) {
    var selector = 'input[placeholder], textarea[placeholder]'

    function emulatePlaceholder(input) {
      var val = input.getValue(), text = input.readAttribute('placeholder')
      if (val.empty() || val === text)
        input.setValue(text).addClassName('placeholder')
    }

    document.on('focusin', selector, function(e, input) {
      if (input.getValue() === input.readAttribute('placeholder'))
        input.setValue('').removeClassName('placeholder')
    })

    document.on('focusout', selector, function(e, input) {
      emulatePlaceholder(input)
    })

    $$(selector).each(emulatePlaceholder)

    $(document.body).on('submit', 'form:has(' + selector + ')', function(e, form) {
      form.select(selector).each(function(field) {
        if (field.getValue() == field.readAttribute('placeholder')) field.setValue('')
      })
    })

    document.on('DOMNodeInserted', 'form', function(e) {
      if (e.element().match('form')) e.element().select(selector).each(emulatePlaceholder)
    })
  }

  if (!Modernizr.input.autofocus) {
    var input = $(document.body).down('input[autofocus]')
    if (input) input.activate()
  }

  Modernizr.addTest('inputsearch', function() {
    return Modernizr.inputtypes.search
  })
})


var Builder = {
  NODEMAP: {
    AREA: 'map',
    CAPTION: 'table',
    COL: 'table',
    COLGROUP: 'table',
    LEGEND: 'fieldset',
    OPTGROUP: 'select',
    OPTION: 'select',
    PARAM: 'object',
    TBODY: 'table',
    TD: 'table',
    TFOOT: 'table',
    TH: 'table',
    THEAD: 'table',
    TR: 'table'
  },
  node: function(elementName) {
    elementName = elementName.toUpperCase();

    var parentTag = this.NODEMAP[elementName] || 'div';
    var parentElement = document.createElement(parentTag);
    try { // prevent IE "feature": http://dev.rubyonrails.org/ticket/2707
      parentElement.innerHTML = "<" + elementName + "></" + elementName + ">";
    } catch(e) {}
    var element = parentElement.firstChild || null;

    if(element && (element.tagName.toUpperCase() != elementName))
      element = element.getElementsByTagName(elementName)[0];

    if(!element) element = document.createElement(elementName);

    if(!element) return;

    if(arguments[1])
      if(this._isStringOrNumber(arguments[1]) ||
        (arguments[1] instanceof Array) ||
        arguments[1].tagName) {
          this._children(element, arguments[1]);
        } else {
          var attrs = this._attributes(arguments[1]);
          if(attrs.length) {
            try { // prevent IE "feature": http://dev.rubyonrails.org/ticket/2707
              parentElement.innerHTML = "<" +elementName + " " +
                attrs + "></" + elementName + ">";
            } catch(e) {}
            element = parentElement.firstChild || null;
            if(!element) {
              element = document.createElement(elementName);
              for(attr in arguments[1])
                element[attr == 'class' ? 'className' : attr] = arguments[1][attr];
            }
            if(element.tagName.toUpperCase() != elementName)
              element = parentElement.getElementsByTagName(elementName)[0];
          }
        }

    if(arguments[2])
      this._children(element, arguments[2]);

     return $(element);
  },
  _text: function(text) {
     return document.createTextNode(text);
  },

  ATTR_MAP: {
    'className': 'class',
    'htmlFor': 'for'
  },

  _attributes: function(attributes) {
    var attrs = [];
    for(attribute in attributes)
      attrs.push((attribute in this.ATTR_MAP ? this.ATTR_MAP[attribute] : attribute) +
          '="' + attributes[attribute].toString().escapeHTML().gsub(/"/,'&quot;') + '"');
    return attrs.join(" ");
  },
  _children: function(element, children) {
    if(children.tagName) {
      element.appendChild(children);
      return;
    }
    if(typeof children=='object') { // array can hold nodes and text
      children.flatten().each( function(e) {
        if(typeof e=='object')
          element.appendChild(e);
        else
          if(Builder._isStringOrNumber(e))
            element.appendChild(Builder._text(e));
      });
    } else
      if(Builder._isStringOrNumber(children))
        element.appendChild(Builder._text(children));
  },
  _isStringOrNumber: function(param) {
    return(typeof param=='string' || typeof param=='number');
  },
  build: function(html) {
    var element = this.node('div');
    $(element).update(html.strip());
    return element.down();
  },
  dump: function(scope) {
    if(typeof scope != 'object' && typeof scope != 'function') scope = window; //global scope

    var tags = ("A ABBR ACRONYM ADDRESS APPLET AREA B BASE BASEFONT BDO BIG BLOCKQUOTE BODY " +
      "BR BUTTON CAPTION CENTER CITE CODE COL COLGROUP DD DEL DFN DIR DIV DL DT EM FIELDSET " +
      "FONT FORM FRAME FRAMESET H1 H2 H3 H4 H5 H6 HEAD HR HTML I IFRAME IMG INPUT INS ISINDEX "+
      "KBD LABEL LEGEND LI LINK MAP MENU META NOFRAMES NOSCRIPT OBJECT OL OPTGROUP OPTION P "+
      "PARAM PRE Q S SAMP SCRIPT SELECT SMALL SPAN STRIKE STRONG STYLE SUB SUP TABLE TBODY TD "+
      "TEXTAREA TFOOT TH THEAD TITLE TR TT U UL VAR").split(/\s+/);

    tags.each( function(tag){
      scope[tag] = function() {
        return Builder.node.apply(Builder, [tag].concat($A(arguments)));
      };
    });
  }
};


String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + .5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + .75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + .5;
    },
    pulse: function(pos, pulses) {
      return (-Math.cos((pos*((pulses||5)-.5)*2)*Math.PI)/2) + .5;
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect, options) {
    element = $(element);
    effect  = (effect || 'appear').toLowerCase();

    return Effect[ Effect.PAIRS[ effect ][ element.visible() ? 1 : 0 ] ](element, Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, options || {}));
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    this.render = (function() {
      function dispatch(effect, eventName) {
        if (effect.options[eventName + 'Internal'])
          effect.options[eventName + 'Internal'](effect);
        if (effect.options[eventName])
          effect.options[eventName](effect);
      }

      return function(pos) {
        if (this.state === "idle") {
          this.state = "running";
          dispatch(this, 'beforeSetup');
          if (this.setup) this.setup();
          dispatch(this, 'afterSetup');
        }
        if (this.state === "running") {
          pos = (this.options.transition(pos) * this.fromToDelta) + this.options.from;
          this.position = pos;
          dispatch(this, 'beforeUpdate');
          if (this.update) this.update(pos);
          dispatch(this, 'afterUpdate');
        }
      };
    })();

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
  scrollOffsets = document.viewport.getScrollOffsets(),
  elementOffsets = $(element).cumulativeOffset();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()); }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element);
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      });
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}); }}); }}); }}); }}); }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      );
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { },
    oldOpacity = element.getInlineOpacity(),
    transition = options.transition || Effect.Transitions.linear,
    reverser   = function(pos){
      return 1 - transition((-Math.cos((pos*(options.pulses||5)*2)*Math.PI)/2) + .5);
    };

  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        };
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 );
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      );
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
}

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element);
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    };
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);



if(typeof Effect == 'undefined')
  throw("controls.js requires including script.aculo.us' effects.js library");

var Autocompleter = { };
Autocompleter.Base = Class.create({
  baseInitialize: function(element, update, options) {
    element          = $(element);
    this.element     = element;
    this.update      = $(update);
    this.hasFocus    = false;
    this.changed     = false;
    this.active      = false;
    this.index       = 0;
    this.entryCount  = 0;
    this.oldElementValue = this.element.value;

    if(this.setOptions)
      this.setOptions(options);
    else
      this.options = options || { };

    this.options.paramName    = this.options.paramName || this.element.name;
    this.options.tokens       = this.options.tokens || [];
    this.options.frequency    = this.options.frequency || 0.4;
    this.options.minChars     = this.options.minChars || 1;
    this.options.onShow       = this.options.onShow ||
      function(element, update){
        if(!update.style.position || update.style.position=='absolute') {
          update.style.position = 'absolute';
          Position.clone(element, update, {
            setHeight: false,
            offsetTop: element.offsetHeight
          });
          if (Prototype.Browser.IE){
            update.style.position = 'relative';
            update.style.top = '0px';
            update.style.left = '0px';
          }
        }
        Effect.Appear(update,{duration:0.15});
      };
    this.options.onHide = this.options.onHide ||
      function(element, update){ new Effect.Fade(update,{duration:0.15}) };

    if(typeof(this.options.tokens) == 'string')
      this.options.tokens = new Array(this.options.tokens);
    if (!this.options.tokens.include('\n'))
      this.options.tokens.push('\n');

    this.observer = null;

    this.element.setAttribute('autocomplete','off');

    Element.hide(this.update);

    Event.observe(this.element, 'blur', this.onBlur.bindAsEventListener(this));
    Event.observe(this.element, 'keydown', this.onKeyPress.bindAsEventListener(this));
  },

  show: function() {
    if(Element.getStyle(this.update, 'display')=='none') this.options.onShow(this.element, this.update);
    if(!this.iefix &&
      (Prototype.Browser.IE) &&
      (Element.getStyle(this.update, 'position')=='absolute')) {
      new Insertion.After(this.update,
       '<iframe id="' + this.update.id + '_iefix" '+
       'style="display:none;position:absolute;filter:progid:DXImageTransform.Microsoft.Alpha(opacity=0);" ' +
       'src="javascript:false;" frameborder="0" scrolling="no"></iframe>');
      this.iefix = $(this.update.id+'_iefix');
    }
    if(this.iefix) setTimeout(this.fixIEOverlapping.bind(this), 50);
  },

  fixIEOverlapping: function() {
    Position.clone(this.update, this.iefix, {setTop:(!this.update.style.height)});
    this.iefix.style.zIndex = 1;
    this.update.style.zIndex = 2;
    Element.show(this.iefix);
  },

  hide: function() {
    this.stopIndicator();
    if(Element.getStyle(this.update, 'display')!='none') this.options.onHide(this.element, this.update);
    if(this.iefix) Element.hide(this.iefix);
  },

  startIndicator: function() {
    if(this.options.indicator) Element.show(this.options.indicator);
  },

  stopIndicator: function() {
    if(this.options.indicator) Element.hide(this.options.indicator);
  },

  onKeyPress: function(event) {
    if(this.active)
      switch(event.keyCode) {
       case Event.KEY_TAB:
       case Event.KEY_RETURN:
         this.selectEntry();
         Event.stop(event);
       case Event.KEY_ESC:
         this.hide();
         this.active = false;
         Event.stop(event);
         return;
       case Event.KEY_LEFT:
       case Event.KEY_RIGHT:
         return;
       case Event.KEY_UP:
         this.markPrevious();
         this.render();
         Event.stop(event);
         return;
       case Event.KEY_DOWN:
         this.markNext();
         this.render();
         Event.stop(event);
         return;
      }
     else
       if(event.keyCode==Event.KEY_TAB || event.keyCode==Event.KEY_RETURN ||
         (Prototype.Browser.WebKit > 0 && event.keyCode == 0)) return;

    this.changed = true;
    this.hasFocus = true;

    if(this.observer) clearTimeout(this.observer);
      this.observer =
        setTimeout(this.onObserverEvent.bind(this), this.options.frequency*1000);
  },

  activate: function() {
    this.changed = false;
    this.hasFocus = true;
    this.getUpdatedChoices();
  },

  onHover: function(event) {
    var element = Event.findElement(event, 'LI');
    if(this.index != element.autocompleteIndex)
    {
        this.index = element.autocompleteIndex;
        this.render();
    }
    Event.stop(event);
  },

  onClick: function(event) {
    var element = Event.findElement(event, 'LI');
    this.index = element.autocompleteIndex;
    this.selectEntry();
    this.hide();
  },

  onBlur: function(event) {
    setTimeout(this.hide.bind(this), 250);
    this.hasFocus = false;
    this.active = false;
  },

  render: function() {
    if(this.entryCount > 0) {
      for (var i = 0; i < this.entryCount; i++)
        this.index==i ?
          Element.addClassName(this.getEntry(i),"selected") :
          Element.removeClassName(this.getEntry(i),"selected");
      if(this.hasFocus) {
        this.show();
        this.active = true;
      }
    } else {
      this.active = false;
      this.hide();
    }
  },

  markPrevious: function() {
    if(this.index > 0) {this.index--;}
    else {
      this.index = this.entryCount-1;
      this.update.scrollTop = this.update.scrollHeight;
    }
    selection = this.getEntry(this.index);
    selection_top = selection.offsetTop;
    if(selection_top < this.update.scrollTop){
      this.update.scrollTop = this.update.scrollTop-selection.offsetHeight;
    }
  },

  markNext: function() {
    if(this.index < this.entryCount-1) {this.index++;}
    else {
      this.index = 0;
      this.update.scrollTop = 0;
    }
    selection = this.getEntry(this.index);
    selection_bottom = selection.offsetTop+selection.offsetHeight;
    if(selection_bottom > this.update.scrollTop+this.update.offsetHeight){
      this.update.scrollTop = this.update.scrollTop+selection.offsetHeight;
    }
  },

  getEntry: function(index) {
    return this.update.firstChild.childNodes[index];
  },

  getCurrentEntry: function() {
    return this.getEntry(this.index);
  },

  selectEntry: function() {
    this.active = false;
    this.updateElement(this.getCurrentEntry());
  },

  updateElement: function(selectedElement) {
    if (this.options.updateElement) {
      this.options.updateElement(selectedElement);
      return;
    }
    var value = '';
    if (this.options.select) {
      var nodes = $(selectedElement).select('.' + this.options.select) || [];
      if(nodes.length>0) value = Element.collectTextNodes(nodes[0], this.options.select);
    } else
      value = Element.collectTextNodesIgnoreClass(selectedElement, 'informal');

    var bounds = this.getTokenBounds();
    if (bounds[0] != -1) {
      var newValue = this.element.value.substr(0, bounds[0]);
      var whitespace = this.element.value.substr(bounds[0]).match(/^\s+/);
      if (whitespace)
        newValue += whitespace[0];
      this.element.value = newValue + value + this.element.value.substr(bounds[1]);
    } else {
      this.element.value = value;
    }
    this.oldElementValue = this.element.value;
    this.element.focus();

    if (this.options.afterUpdateElement)
      this.options.afterUpdateElement(this.element, selectedElement);
  },

  updateChoices: function(choices) {
    if(!this.changed && this.hasFocus) {
      this.update.innerHTML = choices;
      Element.cleanWhitespace(this.update);
      Element.cleanWhitespace(this.update.down());

      if(this.update.firstChild && this.update.down().childNodes) {
        this.entryCount =
          this.update.down().childNodes.length;
        for (var i = 0; i < this.entryCount; i++) {
          var entry = this.getEntry(i);
          entry.autocompleteIndex = i;
          this.addObservers(entry);
        }
      } else {
        this.entryCount = 0;
      }

      this.stopIndicator();
      this.index = 0;

      if(this.entryCount==1 && this.options.autoSelect) {
        this.selectEntry();
        this.hide();
      } else {
        this.render();
      }
    }
  },

  addObservers: function(element) {
    Event.observe(element, "mouseover", this.onHover.bindAsEventListener(this));
    Event.observe(element, "click", this.onClick.bindAsEventListener(this));
  },

  onObserverEvent: function() {
    this.changed = false;
    this.tokenBounds = null;
    if(this.getToken().length>=this.options.minChars) {
      this.getUpdatedChoices();
    } else {
      this.active = false;
      this.hide();
    }
    this.oldElementValue = this.element.value;
  },

  getToken: function() {
    var bounds = this.getTokenBounds();
    return this.element.value.substring(bounds[0], bounds[1]).strip();
  },

  getTokenBounds: function() {
    if (null != this.tokenBounds) return this.tokenBounds;
    var value = this.element.value;
    if (value.strip().empty()) return [-1, 0];
    var diff = arguments.callee.getFirstDifferencePos(value, this.oldElementValue);
    var offset = (diff == this.oldElementValue.length ? 1 : 0);
    var prevTokenPos = -1, nextTokenPos = value.length;
    var tp;
    for (var index = 0, l = this.options.tokens.length; index < l; ++index) {
      tp = value.lastIndexOf(this.options.tokens[index], diff + offset - 1);
      if (tp > prevTokenPos) prevTokenPos = tp;
      tp = value.indexOf(this.options.tokens[index], diff + offset);
      if (-1 != tp && tp < nextTokenPos) nextTokenPos = tp;
    }
    return (this.tokenBounds = [prevTokenPos + 1, nextTokenPos]);
  }
});

Autocompleter.Base.prototype.getTokenBounds.getFirstDifferencePos = function(newS, oldS) {
  var boundary = Math.min(newS.length, oldS.length);
  for (var index = 0; index < boundary; ++index)
    if (newS[index] != oldS[index])
      return index;
  return boundary;
};

Ajax.Autocompleter = Class.create(Autocompleter.Base, {
  initialize: function(element, update, url, options) {
    this.baseInitialize(element, update, options);
    this.options.asynchronous  = true;
    this.options.onComplete    = this.onComplete.bind(this);
    this.options.defaultParams = this.options.parameters || null;
    this.url                   = url;
  },

  getUpdatedChoices: function() {
    this.startIndicator();

    var entry = encodeURIComponent(this.options.paramName) + '=' +
      encodeURIComponent(this.getToken());

    this.options.parameters = this.options.callback ?
      this.options.callback(this.element, entry) : entry;

    if(this.options.defaultParams)
      this.options.parameters += '&' + this.options.defaultParams;

    new Ajax.Request(this.url, this.options);
  },

  onComplete: function(request) {
    this.updateChoices(request.responseText);
  }
});


Autocompleter.Local = Class.create(Autocompleter.Base, {
  initialize: function(element, update, array, options) {
    this.baseInitialize(element, update, options);
    this.options.array = array;
  },

  getUpdatedChoices: function() {
    this.updateChoices(this.options.selector(this));
  },

  setOptions: function(options) {
    this.options = Object.extend({
      choices: 10,
      partialSearch: true,
      partialChars: 2,
      ignoreCase: true,
      fullSearch: false,
      selector: function(instance) {
        var ret       = []; // Beginning matches
        var partial   = []; // Inside matches
        var entry     = instance.getToken();
        var count     = 0;
        var tagStrip  = /([^<]*)/;

        for (var i = 0; i < instance.options.array.length &&
          ret.length < instance.options.choices ; i++) {

          var elem_rep = instance.options.array[i];
          var elem = tagStrip.exec(elem_rep)[1];
          elem = elem ? elem : "";
          var foundPos = instance.options.ignoreCase ?
            elem.toLowerCase().indexOf(entry.toLowerCase()) :
            elem.indexOf(entry);

          while (foundPos != -1) {
            if (foundPos == 0 && elem.length != entry.length) {
              ret.push("<li><strong>" + elem_rep.substr(0, entry.length) + "</strong>" +
                elem_rep.substr(entry.length) + "</li>");
              break;
            } else if (entry.length >= instance.options.partialChars &&
              instance.options.partialSearch && foundPos != -1) {
              if (instance.options.fullSearch || /\s/.test(elem_rep.substr(foundPos-1,1))) {
                partial.push("<li>" + elem_rep.substr(0, foundPos) + "<strong>" +
                  elem_rep.substr(foundPos, entry.length) + "</strong>" + elem_rep.substr(
                  foundPos + entry.length) + "</li>");
                break;
              }
            }

            foundPos = instance.options.ignoreCase ?
              elem.toLowerCase().indexOf(entry.toLowerCase(), foundPos + 1) :
              elem.indexOf(entry, foundPos + 1);
          }
        }
        if (partial.length)
          ret = ret.concat(partial.slice(0, instance.options.choices - ret.length));
        return "<ul>" + ret.join('') + "</ul>";
      }
    }, options || { });
  }
});


Field.scrollFreeActivate = function(field) {
  setTimeout(function() {
    Field.activate(field);
  }, 1);
};

Ajax.InPlaceEditor = Class.create({
  initialize: function(element, url, options) {
    this.url = url;
    this.element = element = $(element);
    this.prepareOptions();
    this._controls = { };
    arguments.callee.dealWithDeprecatedOptions(options); // DEPRECATION LAYER!!!
    Object.extend(this.options, options || { });
    if (!this.options.formId && this.element.id) {
      this.options.formId = this.element.id + '-inplaceeditor';
      if ($(this.options.formId))
        this.options.formId = '';
    }
    if (this.options.externalControl)
      this.options.externalControl = $(this.options.externalControl);
    if (!this.options.externalControl)
      this.options.externalControlOnly = false;
    this._originalBackground = this.element.getStyle('background-color') || 'transparent';
    this.element.title = this.options.clickToEditText;
    this._boundCancelHandler = this.handleFormCancellation.bind(this);
    this._boundComplete = (this.options.onComplete || Prototype.emptyFunction).bind(this);
    this._boundFailureHandler = this.handleAJAXFailure.bind(this);
    this._boundSubmitHandler = this.handleFormSubmission.bind(this);
    this._boundWrapperHandler = this.wrapUp.bind(this);
    this.registerListeners();
  },
  checkForEscapeOrReturn: function(e) {
    if (!this._editing || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (Event.KEY_ESC == e.keyCode)
      this.handleFormCancellation(e);
    else if (Event.KEY_RETURN == e.keyCode)
      this.handleFormSubmission(e);
  },
  createControl: function(mode, handler, extraClasses) {
    var control = this.options[mode + 'Control'];
    var text = this.options[mode + 'Text'];
    if ('button' == control) {
      var btn = document.createElement('input');
      btn.type = 'submit';
      btn.value = text;
      btn.className = 'editor_' + mode + '_button';
      if ('cancel' == mode)
        btn.onclick = this._boundCancelHandler;
      this._form.appendChild(btn);
      this._controls[mode] = btn;
    } else if ('link' == control) {
      var link = document.createElement('a');
      link.href = '#';
      link.appendChild(document.createTextNode(text));
      link.onclick = 'cancel' == mode ? this._boundCancelHandler : this._boundSubmitHandler;
      link.className = 'editor_' + mode + '_link';
      if (extraClasses)
        link.className += ' ' + extraClasses;
      this._form.appendChild(link);
      this._controls[mode] = link;
    }
  },
  createEditField: function() {
    var text = (this.options.loadTextURL ? this.options.loadingText : this.getText());
    var fld;
    if (1 >= this.options.rows && !/\r|\n/.test(this.getText())) {
      fld = document.createElement('input');
      fld.type = 'text';
      var size = this.options.size || this.options.cols || 0;
      if (0 < size) fld.size = size;
    } else {
      fld = document.createElement('textarea');
      fld.rows = (1 >= this.options.rows ? this.options.autoRows : this.options.rows);
      fld.cols = this.options.cols || 40;
    }
    fld.name = this.options.paramName;
    fld.value = text; // No HTML breaks conversion anymore
    fld.className = 'editor_field';
    if (this.options.submitOnBlur)
      fld.onblur = this._boundSubmitHandler;
    this._controls.editor = fld;
    if (this.options.loadTextURL)
      this.loadExternalText();
    this._form.appendChild(this._controls.editor);
  },
  createForm: function() {
    var ipe = this;
    function addText(mode, condition) {
      var text = ipe.options['text' + mode + 'Controls'];
      if (!text || condition === false) return;
      ipe._form.appendChild(document.createTextNode(text));
    };
    this._form = $(document.createElement('form'));
    this._form.id = this.options.formId;
    this._form.addClassName(this.options.formClassName);
    this._form.onsubmit = this._boundSubmitHandler;
    this.createEditField();
    if ('textarea' == this._controls.editor.tagName.toLowerCase())
      this._form.appendChild(document.createElement('br'));
    if (this.options.onFormCustomization)
      this.options.onFormCustomization(this, this._form);
    addText('Before', this.options.okControl || this.options.cancelControl);
    this.createControl('ok', this._boundSubmitHandler);
    addText('Between', this.options.okControl && this.options.cancelControl);
    this.createControl('cancel', this._boundCancelHandler, 'editor_cancel');
    addText('After', this.options.okControl || this.options.cancelControl);
  },
  destroy: function() {
    if (this._oldInnerHTML)
      this.element.innerHTML = this._oldInnerHTML;
    this.leaveEditMode();
    this.unregisterListeners();
  },
  enterEditMode: function(e) {
    if (this._saving || this._editing) return;
    this._editing = true;
    this.triggerCallback('onEnterEditMode');
    if (this.options.externalControl)
      this.options.externalControl.hide();
    this.element.hide();
    this.createForm();
    this.element.parentNode.insertBefore(this._form, this.element);
    if (!this.options.loadTextURL)
      this.postProcessEditField();
    if (e) Event.stop(e);
  },
  enterHover: function(e) {
    if (this.options.hoverClassName)
      this.element.addClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onEnterHover');
  },
  getText: function() {
    return this.element.innerHTML.unescapeHTML();
  },
  handleAJAXFailure: function(transport) {
    this.triggerCallback('onFailure', transport);
    if (this._oldInnerHTML) {
      this.element.innerHTML = this._oldInnerHTML;
      this._oldInnerHTML = null;
    }
  },
  handleFormCancellation: function(e) {
    this.wrapUp();
    if (e) Event.stop(e);
  },
  handleFormSubmission: function(e) {
    var form = this._form;
    var value = $F(this._controls.editor);
    this.prepareSubmission();
    var params = this.options.callback(form, value) || '';
    if (Object.isString(params))
      params = params.toQueryParams();
    params.editorId = this.element.id;
    if (this.options.htmlResponse) {
      var options = Object.extend({ evalScripts: true }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Updater({ success: this.element }, this.url, options);
    } else {
      var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Request(this.url, options);
    }
    if (e) Event.stop(e);
  },
  leaveEditMode: function() {
    this.element.removeClassName(this.options.savingClassName);
    this.removeForm();
    this.leaveHover();
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
    if (this.options.externalControl)
      this.options.externalControl.show();
    this._saving = false;
    this._editing = false;
    this._oldInnerHTML = null;
    this.triggerCallback('onLeaveEditMode');
  },
  leaveHover: function(e) {
    if (this.options.hoverClassName)
      this.element.removeClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onLeaveHover');
  },
  loadExternalText: function() {
    this._form.addClassName(this.options.loadingClassName);
    this._controls.editor.disabled = true;
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._form.removeClassName(this.options.loadingClassName);
        var text = transport.responseText;
        if (this.options.stripLoadedTextTags)
          text = text.stripTags();
        this._controls.editor.value = text;
        this._controls.editor.disabled = false;
        this.postProcessEditField();
      }.bind(this),
      onFailure: this._boundFailureHandler
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },
  postProcessEditField: function() {
    var fpc = this.options.fieldPostCreation;
    if (fpc)
      $(this._controls.editor)['focus' == fpc ? 'focus' : 'activate']();
  },
  prepareOptions: function() {
    this.options = Object.clone(Ajax.InPlaceEditor.DefaultOptions);
    Object.extend(this.options, Ajax.InPlaceEditor.DefaultCallbacks);
    [this._extraDefaultOptions].flatten().compact().each(function(defs) {
      Object.extend(this.options, defs);
    }.bind(this));
  },
  prepareSubmission: function() {
    this._saving = true;
    this.removeForm();
    this.leaveHover();
    this.showSaving();
  },
  registerListeners: function() {
    this._listeners = { };
    var listener;
    $H(Ajax.InPlaceEditor.Listeners).each(function(pair) {
      listener = this[pair.value].bind(this);
      this._listeners[pair.key] = listener;
      if (!this.options.externalControlOnly)
        this.element.observe(pair.key, listener);
      if (this.options.externalControl)
        this.options.externalControl.observe(pair.key, listener);
    }.bind(this));
  },
  removeForm: function() {
    if (!this._form) return;
    this._form.remove();
    this._form = null;
    this._controls = { };
  },
  showSaving: function() {
    this._oldInnerHTML = this.element.innerHTML;
    this.element.innerHTML = this.options.savingText;
    this.element.addClassName(this.options.savingClassName);
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
  },
  triggerCallback: function(cbName, arg) {
    if ('function' == typeof this.options[cbName]) {
      this.options[cbName](this, arg);
    }
  },
  unregisterListeners: function() {
    $H(this._listeners).each(function(pair) {
      if (!this.options.externalControlOnly)
        this.element.stopObserving(pair.key, pair.value);
      if (this.options.externalControl)
        this.options.externalControl.stopObserving(pair.key, pair.value);
    }.bind(this));
  },
  wrapUp: function(transport) {
    this.leaveEditMode();
    this._boundComplete(transport, this.element);
  }
});

Object.extend(Ajax.InPlaceEditor.prototype, {
  dispose: Ajax.InPlaceEditor.prototype.destroy
});

Ajax.InPlaceCollectionEditor = Class.create(Ajax.InPlaceEditor, {
  initialize: function($super, element, url, options) {
    this._extraDefaultOptions = Ajax.InPlaceCollectionEditor.DefaultOptions;
    $super(element, url, options);
  },

  createEditField: function() {
    var list = document.createElement('select');
    list.name = this.options.paramName;
    list.size = 1;
    this._controls.editor = list;
    this._collection = this.options.collection || [];
    if (this.options.loadCollectionURL)
      this.loadCollection();
    else
      this.checkForExternalText();
    this._form.appendChild(this._controls.editor);
  },

  loadCollection: function() {
    this._form.addClassName(this.options.loadingClassName);
    this.showLoadingText(this.options.loadingCollectionText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        var js = transport.responseText.strip();
        if (!/^\[.*\]$/.test(js)) // TODO: improve sanity check
          throw('Server returned an invalid collection representation.');
        this._collection = eval(js);
        this.checkForExternalText();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadCollectionURL, options);
  },

  showLoadingText: function(text) {
    this._controls.editor.disabled = true;
    var tempOption = this._controls.editor.firstChild;
    if (!tempOption) {
      tempOption = document.createElement('option');
      tempOption.value = '';
      this._controls.editor.appendChild(tempOption);
      tempOption.selected = true;
    }
    tempOption.update((text || '').stripScripts().stripTags());
  },

  checkForExternalText: function() {
    this._text = this.getText();
    if (this.options.loadTextURL)
      this.loadExternalText();
    else
      this.buildOptionList();
  },

  loadExternalText: function() {
    this.showLoadingText(this.options.loadingText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._text = transport.responseText.strip();
        this.buildOptionList();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },

  buildOptionList: function() {
    this._form.removeClassName(this.options.loadingClassName);
    this._collection = this._collection.map(function(entry) {
      return 2 === entry.length ? entry : [entry, entry].flatten();
    });
    var marker = ('value' in this.options) ? this.options.value : this._text;
    var textFound = this._collection.any(function(entry) {
      return entry[0] == marker;
    }.bind(this));
    this._controls.editor.update('');
    var option;
    this._collection.each(function(entry, index) {
      option = document.createElement('option');
      option.value = entry[0];
      option.selected = textFound ? entry[0] == marker : 0 == index;
      option.appendChild(document.createTextNode(entry[1]));
      this._controls.editor.appendChild(option);
    }.bind(this));
    this._controls.editor.disabled = false;
    Field.scrollFreeActivate(this._controls.editor);
  }
});


Ajax.InPlaceEditor.prototype.initialize.dealWithDeprecatedOptions = function(options) {
  if (!options) return;
  function fallback(name, expr) {
    if (name in options || expr === undefined) return;
    options[name] = expr;
  };
  fallback('cancelControl', (options.cancelLink ? 'link' : (options.cancelButton ? 'button' :
    options.cancelLink == options.cancelButton == false ? false : undefined)));
  fallback('okControl', (options.okLink ? 'link' : (options.okButton ? 'button' :
    options.okLink == options.okButton == false ? false : undefined)));
  fallback('highlightColor', options.highlightcolor);
  fallback('highlightEndColor', options.highlightendcolor);
};

Object.extend(Ajax.InPlaceEditor, {
  DefaultOptions: {
    ajaxOptions: { },
    autoRows: 3,                                // Use when multi-line w/ rows == 1
    cancelControl: 'link',                      // 'link'|'button'|false
    cancelText: 'cancel',
    clickToEditText: 'Click to edit',
    externalControl: null,                      // id|elt
    externalControlOnly: false,
    fieldPostCreation: 'activate',              // 'activate'|'focus'|false
    formClassName: 'inplaceeditor-form',
    formId: null,                               // id|elt
    highlightColor: '#ffff99',
    highlightEndColor: '#ffffff',
    hoverClassName: '',
    htmlResponse: true,
    loadingClassName: 'inplaceeditor-loading',
    loadingText: 'Loading...',
    okControl: 'button',                        // 'link'|'button'|false
    okText: 'ok',
    paramName: 'value',
    rows: 1,                                    // If 1 and multi-line, uses autoRows
    savingClassName: 'inplaceeditor-saving',
    savingText: 'Saving...',
    size: 0,
    stripLoadedTextTags: false,
    submitOnBlur: false,
    textAfterControls: '',
    textBeforeControls: '',
    textBetweenControls: ''
  },
  DefaultCallbacks: {
    callback: function(form) {
      return Form.serialize(form);
    },
    onComplete: function(transport, element) {
      new Effect.Highlight(element, {
        startcolor: this.options.highlightColor, keepBackgroundImage: true });
    },
    onEnterEditMode: null,
    onEnterHover: function(ipe) {
      ipe.element.style.backgroundColor = ipe.options.highlightColor;
      if (ipe._effect)
        ipe._effect.cancel();
    },
    onFailure: function(transport, ipe) {
      alert('Error communication with the server: ' + transport.responseText.stripTags());
    },
    onFormCustomization: null, // Takes the IPE and its generated form, after editor, before controls.
    onLeaveEditMode: null,
    onLeaveHover: function(ipe) {
      ipe._effect = new Effect.Highlight(ipe.element, {
        startcolor: ipe.options.highlightColor, endcolor: ipe.options.highlightEndColor,
        restorecolor: ipe._originalBackground, keepBackgroundImage: true
      });
    }
  },
  Listeners: {
    click: 'enterEditMode',
    keydown: 'checkForEscapeOrReturn',
    mouseover: 'enterHover',
    mouseout: 'leaveHover'
  }
});

Ajax.InPlaceCollectionEditor.DefaultOptions = {
  loadingCollectionText: 'Loading options...'
};


Form.Element.DelayedObserver = Class.create({
  initialize: function(element, delay, callback) {
    this.delay     = delay || 0.5;
    this.element   = $(element);
    this.callback  = callback;
    this.timer     = null;
    this.lastValue = $F(this.element);
    Event.observe(this.element,'keyup',this.delayedListener.bindAsEventListener(this));
  },
  delayedListener: function(event) {
    if(this.lastValue == $F(this.element)) return;
    if(this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onTimerEvent.bind(this), this.delay * 1000);
    this.lastValue = $F(this.element);
  },
  onTimerEvent: function() {
    this.timer = null;
    this.callback(this.element, $F(this.element));
  }
});


if(Object.isUndefined(Effect))
  throw("dragdrop.js requires including script.aculo.us' effects.js library");

var Droppables = {
  drops: [],

  remove: function(element) {
    this.drops = this.drops.reject(function(d) { return d.element==$(element) });
  },

  add: function(element) {
    element = $(element);
    var options = Object.extend({
      greedy:     true,
      hoverclass: null,
      tree:       false
    }, arguments[1] || { });

    if(options.containment) {
      options._containers = [];
      var containment = options.containment;
      if(Object.isArray(containment)) {
        containment.each( function(c) { options._containers.push($(c)) });
      } else {
        options._containers.push($(containment));
      }
    }

    if(options.accept) options.accept = [options.accept].flatten();

    Element.makePositioned(element); // fix IE
    options.element = element;

    this.drops.push(options);
  },

  findDeepestChild: function(drops) {
    deepest = drops[0];

    for (i = 1; i < drops.length; ++i)
      if (Element.isParent(drops[i].element, deepest.element))
        deepest = drops[i];

    return deepest;
  },

  isContained: function(element, drop) {
    var containmentNode;
    if(drop.tree) {
      containmentNode = element.treeNode;
    } else {
      containmentNode = element.parentNode;
    }
    return drop._containers.detect(function(c) { return containmentNode == c });
  },

  isAffected: function(point, element, drop) {
    return (
      (drop.element!=element) &&
      ((!drop._containers) ||
        this.isContained(element, drop)) &&
      ((!drop.accept) ||
        (Element.classNames(element).detect(
          function(v) { return drop.accept.include(v) } ) )) &&
      Position.within(drop.element, point[0], point[1]) );
  },

  deactivate: function(drop) {
    if(drop.hoverclass)
      Element.removeClassName(drop.element, drop.hoverclass);
    this.last_active = null;
  },

  activate: function(drop) {
    if(drop.hoverclass)
      Element.addClassName(drop.element, drop.hoverclass);
    this.last_active = drop;
  },

  show: function(point, element) {
    if(!this.drops.length) return;
    var drop, affected = [];

    this.drops.each( function(drop) {
      if(Droppables.isAffected(point, element, drop))
        affected.push(drop);
    });

    if(affected.length>0)
      drop = Droppables.findDeepestChild(affected);

    if(this.last_active && this.last_active != drop) this.deactivate(this.last_active);
    if (drop) {
      Position.within(drop.element, point[0], point[1]);
      if(drop.onHover)
        drop.onHover(element, drop.element, Position.overlap(drop.overlap, drop.element));

      if (drop != this.last_active) Droppables.activate(drop);
    }
  },

  fire: function(event, element) {
    if(!this.last_active) return;
    Position.prepare();

    if (this.isAffected([Event.pointerX(event), Event.pointerY(event)], element, this.last_active))
      if (this.last_active.onDrop) {
        this.last_active.onDrop(element, this.last_active.element, event);
        return true;
      }
  },

  reset: function() {
    if(this.last_active)
      this.deactivate(this.last_active);
  }
};

var Draggables = {
  drags: [],
  observers: [],

  register: function(draggable) {
    if(this.drags.length == 0) {
      this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
      this.eventMouseMove = this.updateDrag.bindAsEventListener(this);
      this.eventKeypress  = this.keyPress.bindAsEventListener(this);

      Event.observe(document, "mouseup", this.eventMouseUp);
      Event.observe(document, "mousemove", this.eventMouseMove);
      Event.observe(document, "keypress", this.eventKeypress);
    }
    this.drags.push(draggable);
  },

  unregister: function(draggable) {
    this.drags = this.drags.reject(function(d) { return d==draggable });
    if(this.drags.length == 0) {
      Event.stopObserving(document, "mouseup", this.eventMouseUp);
      Event.stopObserving(document, "mousemove", this.eventMouseMove);
      Event.stopObserving(document, "keypress", this.eventKeypress);
    }
  },

  activate: function(draggable) {
    if(draggable.options.delay) {
      this._timeout = setTimeout(function() {
        Draggables._timeout = null;
        window.focus();
        Draggables.activeDraggable = draggable;
      }.bind(this), draggable.options.delay);
    } else {
      window.focus(); // allows keypress events if window isn't currently focused, fails for Safari
      this.activeDraggable = draggable;
    }
  },

  deactivate: function() {
    this.activeDraggable = null;
  },

  updateDrag: function(event) {
    if(!this.activeDraggable) return;
    var pointer = [Event.pointerX(event), Event.pointerY(event)];
    if(this._lastPointer && (this._lastPointer.inspect() == pointer.inspect())) return;
    this._lastPointer = pointer;

    this.activeDraggable.updateDrag(event, pointer);
  },

  endDrag: function(event) {
    if(this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if(!this.activeDraggable) return;
    this._lastPointer = null;
    this.activeDraggable.endDrag(event);
    this.activeDraggable = null;
  },

  keyPress: function(event) {
    if(this.activeDraggable)
      this.activeDraggable.keyPress(event);
  },

  addObserver: function(observer) {
    this.observers.push(observer);
    this._cacheObserverCallbacks();
  },

  removeObserver: function(element) {  // element instead of observer fixes mem leaks
    this.observers = this.observers.reject( function(o) { return o.element==element });
    this._cacheObserverCallbacks();
  },

  notify: function(eventName, draggable, event) {  // 'onStart', 'onEnd', 'onDrag'
    if(this[eventName+'Count'] > 0)
      this.observers.each( function(o) {
        if(o[eventName]) o[eventName](eventName, draggable, event);
      });
    if(draggable.options[eventName]) draggable.options[eventName](draggable, event);
  },

  _cacheObserverCallbacks: function() {
    ['onStart','onEnd','onDrag'].each( function(eventName) {
      Draggables[eventName+'Count'] = Draggables.observers.select(
        function(o) { return o[eventName]; }
      ).length;
    });
  }
};

/*--------------------------------------------------------------------------*/

var Draggable = Class.create({
  initialize: function(element) {
    var defaults = {
      handle: false,
      reverteffect: function(element, top_offset, left_offset) {
        var dur = Math.sqrt(Math.abs(top_offset^2)+Math.abs(left_offset^2))*0.02;
        new Effect.Move(element, { x: -left_offset, y: -top_offset, duration: dur,
          queue: {scope:'_draggable', position:'end'}
        });
      },
      endeffect: function(element) {
        var toOpacity = Object.isNumber(element._opacity) ? element._opacity : 1.0;
        new Effect.Opacity(element, {duration:0.2, from:0.7, to:toOpacity,
          queue: {scope:'_draggable', position:'end'},
          afterFinish: function(){
            Draggable._dragging[element] = false
          }
        });
      },
      zindex: 1000,
      revert: false,
      quiet: false,
      scroll: false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      snap: false,  // false, or xy or [x,y] or function(x,y){ return [x,y] }
      delay: 0
    };

    if(!arguments[1] || Object.isUndefined(arguments[1].endeffect))
      Object.extend(defaults, {
        starteffect: function(element) {
          element._opacity = Element.getOpacity(element);
          Draggable._dragging[element] = true;
          new Effect.Opacity(element, {duration:0.2, from:element._opacity, to:0.7});
        }
      });

    var options = Object.extend(defaults, arguments[1] || { });

    this.element = $(element);

    if(options.handle && Object.isString(options.handle))
      this.handle = this.element.down('.'+options.handle, 0);

    if(!this.handle) this.handle = $(options.handle);
    if(!this.handle) this.handle = this.element;

    if(options.scroll && !options.scroll.scrollTo && !options.scroll.outerHTML) {
      options.scroll = $(options.scroll);
      this._isScrollChild = Element.childOf(this.element, options.scroll);
    }

    Element.makePositioned(this.element); // fix IE

    this.options  = options;
    this.dragging = false;

    this.eventMouseDown = this.initDrag.bindAsEventListener(this);
    Event.observe(this.handle, "mousedown", this.eventMouseDown);

    Draggables.register(this);
  },

  destroy: function() {
    Event.stopObserving(this.handle, "mousedown", this.eventMouseDown);
    Draggables.unregister(this);
  },

  currentDelta: function() {
    return([
      parseInt(Element.getStyle(this.element,'left') || '0'),
      parseInt(Element.getStyle(this.element,'top') || '0')]);
  },

  initDrag: function(event) {
    if(!Object.isUndefined(Draggable._dragging[this.element]) &&
      Draggable._dragging[this.element]) return;
    if(Event.isLeftClick(event)) {
      var src = Event.element(event);
      if((tag_name = src.tagName.toUpperCase()) && (
        tag_name=='INPUT' ||
        tag_name=='SELECT' ||
        tag_name=='OPTION' ||
        tag_name=='BUTTON' ||
        tag_name=='TEXTAREA')) return;

      var pointer = [Event.pointerX(event), Event.pointerY(event)];
      var pos     = this.element.cumulativeOffset();
      this.offset = [0,1].map( function(i) { return (pointer[i] - pos[i]) });

      Draggables.activate(this);
      Event.stop(event);
    }
  },

  startDrag: function(event) {
    this.dragging = true;
    if(!this.delta)
      this.delta = this.currentDelta();

    if(this.options.zindex) {
      this.originalZ = parseInt(Element.getStyle(this.element,'z-index') || 0);
      this.element.style.zIndex = this.options.zindex;
    }

    if(this.options.ghosting) {
      this._clone = this.element.cloneNode(true);
      this._originallyAbsolute = (this.element.getStyle('position') == 'absolute');
      if (!this._originallyAbsolute)
        Position.absolutize(this.element);
      this.element.parentNode.insertBefore(this._clone, this.element);
    }

    if(this.options.scroll) {
      if (this.options.scroll == window) {
        var where = this._getWindowScroll(this.options.scroll);
        this.originalScrollLeft = where.left;
        this.originalScrollTop = where.top;
      } else {
        this.originalScrollLeft = this.options.scroll.scrollLeft;
        this.originalScrollTop = this.options.scroll.scrollTop;
      }
    }

    Draggables.notify('onStart', this, event);

    if(this.options.starteffect) this.options.starteffect(this.element);
  },

  updateDrag: function(event, pointer) {
    if(!this.dragging) this.startDrag(event);

    if(!this.options.quiet){
      Position.prepare();
      Droppables.show(pointer, this.element);
    }

    Draggables.notify('onDrag', this, event);

    this.draw(pointer);
    if(this.options.change) this.options.change(this);

    if(this.options.scroll) {
      this.stopScrolling();

      var p;
      if (this.options.scroll == window) {
        with(this._getWindowScroll(this.options.scroll)) { p = [ left, top, left+width, top+height ]; }
      } else {
        p = Position.page(this.options.scroll);
        p[0] += this.options.scroll.scrollLeft + Position.deltaX;
        p[1] += this.options.scroll.scrollTop + Position.deltaY;
        p.push(p[0]+this.options.scroll.offsetWidth);
        p.push(p[1]+this.options.scroll.offsetHeight);
      }
      var speed = [0,0];
      if(pointer[0] < (p[0]+this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[0]+this.options.scrollSensitivity);
      if(pointer[1] < (p[1]+this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[1]+this.options.scrollSensitivity);
      if(pointer[0] > (p[2]-this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[2]-this.options.scrollSensitivity);
      if(pointer[1] > (p[3]-this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[3]-this.options.scrollSensitivity);
      this.startScrolling(speed);
    }

    if(Prototype.Browser.WebKit) window.scrollBy(0,0);

    Event.stop(event);
  },

  finishDrag: function(event, success) {
    this.dragging = false;

    if(this.options.quiet){
      Position.prepare();
      var pointer = [Event.pointerX(event), Event.pointerY(event)];
      Droppables.show(pointer, this.element);
    }

    if(this.options.ghosting) {
      if (!this._originallyAbsolute)
        Position.relativize(this.element);
      delete this._originallyAbsolute;
      Element.remove(this._clone);
      this._clone = null;
    }

    var dropped = false;
    if(success) {
      dropped = Droppables.fire(event, this.element);
      if (!dropped) dropped = false;
    }
    if(dropped && this.options.onDropped) this.options.onDropped(this.element);
    Draggables.notify('onEnd', this, event);

    var revert = this.options.revert;
    if(revert && Object.isFunction(revert)) revert = revert(this.element);

    var d = this.currentDelta();
    if(revert && this.options.reverteffect) {
      if (dropped == 0 || revert != 'failure')
        this.options.reverteffect(this.element,
          d[1]-this.delta[1], d[0]-this.delta[0]);
    } else {
      this.delta = d;
    }

    if(this.options.zindex)
      this.element.style.zIndex = this.originalZ;

    if(this.options.endeffect)
      this.options.endeffect(this.element);

    Draggables.deactivate(this);
    Droppables.reset();
  },

  keyPress: function(event) {
    if(event.keyCode!=Event.KEY_ESC) return;
    this.finishDrag(event, false);
    Event.stop(event);
  },

  endDrag: function(event) {
    if(!this.dragging) return;
    this.stopScrolling();
    this.finishDrag(event, true);
    Event.stop(event);
  },

  draw: function(point) {
    var pos = this.element.cumulativeOffset();
    if(this.options.ghosting) {
      var r   = Position.realOffset(this.element);
      pos[0] += r[0] - Position.deltaX; pos[1] += r[1] - Position.deltaY;
    }

    var d = this.currentDelta();
    pos[0] -= d[0]; pos[1] -= d[1];

    if(this.options.scroll && (this.options.scroll != window && this._isScrollChild)) {
      pos[0] -= this.options.scroll.scrollLeft-this.originalScrollLeft;
      pos[1] -= this.options.scroll.scrollTop-this.originalScrollTop;
    }

    var p = [0,1].map(function(i){
      return (point[i]-pos[i]-this.offset[i])
    }.bind(this));

    if(this.options.snap) {
      if(Object.isFunction(this.options.snap)) {
        p = this.options.snap(p[0],p[1],this);
      } else {
      if(Object.isArray(this.options.snap)) {
        p = p.map( function(v, i) {
          return (v/this.options.snap[i]).round()*this.options.snap[i] }.bind(this));
      } else {
        p = p.map( function(v) {
          return (v/this.options.snap).round()*this.options.snap }.bind(this));
      }
    }}

    var style = this.element.style;
    if((!this.options.constraint) || (this.options.constraint=='horizontal'))
      style.left = p[0] + "px";
    if((!this.options.constraint) || (this.options.constraint=='vertical'))
      style.top  = p[1] + "px";

    if(style.visibility=="hidden") style.visibility = ""; // fix gecko rendering
  },

  stopScrolling: function() {
    if(this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
      Draggables._lastScrollPointer = null;
    }
  },

  startScrolling: function(speed) {
    if(!(speed[0] || speed[1])) return;
    this.scrollSpeed = [speed[0]*this.options.scrollSpeed,speed[1]*this.options.scrollSpeed];
    this.lastScrolled = new Date();
    this.scrollInterval = setInterval(this.scroll.bind(this), 10);
  },

  scroll: function() {
    var current = new Date();
    var delta = current - this.lastScrolled;
    this.lastScrolled = current;
    if(this.options.scroll == window) {
      with (this._getWindowScroll(this.options.scroll)) {
        if (this.scrollSpeed[0] || this.scrollSpeed[1]) {
          var d = delta / 1000;
          this.options.scroll.scrollTo( left + d*this.scrollSpeed[0], top + d*this.scrollSpeed[1] );
        }
      }
    } else {
      this.options.scroll.scrollLeft += this.scrollSpeed[0] * delta / 1000;
      this.options.scroll.scrollTop  += this.scrollSpeed[1] * delta / 1000;
    }

    Position.prepare();
    Droppables.show(Draggables._lastPointer, this.element);
    Draggables.notify('onDrag', this);
    if (this._isScrollChild) {
      Draggables._lastScrollPointer = Draggables._lastScrollPointer || $A(Draggables._lastPointer);
      Draggables._lastScrollPointer[0] += this.scrollSpeed[0] * delta / 1000;
      Draggables._lastScrollPointer[1] += this.scrollSpeed[1] * delta / 1000;
      if (Draggables._lastScrollPointer[0] < 0)
        Draggables._lastScrollPointer[0] = 0;
      if (Draggables._lastScrollPointer[1] < 0)
        Draggables._lastScrollPointer[1] = 0;
      this.draw(Draggables._lastScrollPointer);
    }

    if(this.options.change) this.options.change(this);
  },

  _getWindowScroll: function(w) {
    var T, L, W, H;
    with (w.document) {
      if (w.document.documentElement && documentElement.scrollTop) {
        T = documentElement.scrollTop;
        L = documentElement.scrollLeft;
      } else if (w.document.body) {
        T = body.scrollTop;
        L = body.scrollLeft;
      }
      if (w.innerWidth) {
        W = w.innerWidth;
        H = w.innerHeight;
      } else if (w.document.documentElement && documentElement.clientWidth) {
        W = documentElement.clientWidth;
        H = documentElement.clientHeight;
      } else {
        W = body.offsetWidth;
        H = body.offsetHeight;
      }
    }
    return { top: T, left: L, width: W, height: H };
  }
});

Draggable._dragging = { };

/*--------------------------------------------------------------------------*/

var SortableObserver = Class.create({
  initialize: function(element, observer) {
    this.element   = $(element);
    this.observer  = observer;
    this.lastValue = Sortable.serialize(this.element);
  },

  onStart: function() {
    this.lastValue = Sortable.serialize(this.element);
  },

  onEnd: function() {
    Sortable.unmark();
    if(this.lastValue != Sortable.serialize(this.element))
      this.observer(this.element)
  }
});

var Sortable = {
  SERIALIZE_RULE: /^[^_\-](?:[A-Za-z0-9\-\_]*)[_](.*)$/,

  sortables: { },

  _findRootElement: function(element) {
    while (element.tagName.toUpperCase() != "BODY") {
      if(element.id && Sortable.sortables[element.id]) return element;
      element = element.parentNode;
    }
  },

  options: function(element) {
    element = Sortable._findRootElement($(element));
    if(!element) return;
    return Sortable.sortables[element.id];
  },

  destroy: function(element){
    element = $(element);
    var s = Sortable.sortables[element.id];

    if(s) {
      Draggables.removeObserver(s.element);
      s.droppables.each(function(d){ Droppables.remove(d) });
      s.draggables.invoke('destroy');

      delete Sortable.sortables[s.element.id];
    }
  },

  create: function(element) {
    element = $(element);
    var options = Object.extend({
      element:     element,
      tag:         'li',       // assumes li children, override with tag: 'tagname'
      dropOnEmpty: false,
      tree:        false,
      treeTag:     'ul',
      overlap:     'vertical', // one of 'vertical', 'horizontal'
      constraint:  'vertical', // one of 'vertical', 'horizontal', false
      containment: element,    // also takes array of elements (or id's); or false
      handle:      false,      // or a CSS class
      only:        false,
      delay:       0,
      hoverclass:  null,
      ghosting:    false,
      quiet:       false,
      scroll:      false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      format:      this.SERIALIZE_RULE,

      elements:    false,
      handles:     false,

      onChange:    Prototype.emptyFunction,
      onUpdate:    Prototype.emptyFunction
    }, arguments[1] || { });

    this.destroy(element);

    var options_for_draggable = {
      revert:      true,
      quiet:       options.quiet,
      scroll:      options.scroll,
      scrollSpeed: options.scrollSpeed,
      scrollSensitivity: options.scrollSensitivity,
      delay:       options.delay,
      ghosting:    options.ghosting,
      constraint:  options.constraint,
      handle:      options.handle };

    if(options.starteffect)
      options_for_draggable.starteffect = options.starteffect;

    if(options.reverteffect)
      options_for_draggable.reverteffect = options.reverteffect;
    else
      if(options.ghosting) options_for_draggable.reverteffect = function(element) {
        element.style.top  = 0;
        element.style.left = 0;
      };

    if(options.endeffect)
      options_for_draggable.endeffect = options.endeffect;

    if(options.zindex)
      options_for_draggable.zindex = options.zindex;

    var options_for_droppable = {
      overlap:     options.overlap,
      containment: options.containment,
      tree:        options.tree,
      hoverclass:  options.hoverclass,
      onHover:     Sortable.onHover
    };

    var options_for_tree = {
      onHover:      Sortable.onEmptyHover,
      overlap:      options.overlap,
      containment:  options.containment,
      hoverclass:   options.hoverclass
    };

    Element.cleanWhitespace(element);

    options.draggables = [];
    options.droppables = [];

    if(options.dropOnEmpty || options.tree) {
      Droppables.add(element, options_for_tree);
      options.droppables.push(element);
    }

    (options.elements || this.findElements(element, options) || []).each( function(e,i) {
      var handle = options.handles ? $(options.handles[i]) :
        (options.handle ? $(e).select('.' + options.handle)[0] : e);
      options.draggables.push(
        new Draggable(e, Object.extend(options_for_draggable, { handle: handle })));
      Droppables.add(e, options_for_droppable);
      if(options.tree) e.treeNode = element;
      options.droppables.push(e);
    });

    if(options.tree) {
      (Sortable.findTreeElements(element, options) || []).each( function(e) {
        Droppables.add(e, options_for_tree);
        e.treeNode = element;
        options.droppables.push(e);
      });
    }

    this.sortables[element.identify()] = options;

    Draggables.addObserver(new SortableObserver(element, options.onUpdate));

  },

  findElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.tag);
  },

  findTreeElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.treeTag);
  },

  onHover: function(element, dropon, overlap) {
    if(Element.isParent(dropon, element)) return;

    if(overlap > .33 && overlap < .66 && Sortable.options(dropon).tree) {
      return;
    } else if(overlap>0.5) {
      Sortable.mark(dropon, 'before');
      if(dropon.previousSibling != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, dropon);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    } else {
      Sortable.mark(dropon, 'after');
      var nextElement = dropon.nextSibling || null;
      if(nextElement != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, nextElement);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    }
  },

  onEmptyHover: function(element, dropon, overlap) {
    var oldParentNode = element.parentNode;
    var droponOptions = Sortable.options(dropon);

    if(!Element.isParent(dropon, element)) {
      var index;

      var children = Sortable.findElements(dropon, {tag: droponOptions.tag, only: droponOptions.only});
      var child = null;

      if(children) {
        var offset = Element.offsetSize(dropon, droponOptions.overlap) * (1.0 - overlap);

        for (index = 0; index < children.length; index += 1) {
          if (offset - Element.offsetSize (children[index], droponOptions.overlap) >= 0) {
            offset -= Element.offsetSize (children[index], droponOptions.overlap);
          } else if (offset - (Element.offsetSize (children[index], droponOptions.overlap) / 2) >= 0) {
            child = index + 1 < children.length ? children[index + 1] : null;
            break;
          } else {
            child = children[index];
            break;
          }
        }
      }

      dropon.insertBefore(element, child);

      Sortable.options(oldParentNode).onChange(element);
      droponOptions.onChange(element);
    }
  },

  unmark: function() {
    if(Sortable._marker) Sortable._marker.hide();
  },

  mark: function(dropon, position) {
    var sortable = Sortable.options(dropon.parentNode);
    if(sortable && !sortable.ghosting) return;

    if(!Sortable._marker) {
      Sortable._marker =
        ($('dropmarker') || Element.extend(document.createElement('DIV'))).
          hide().addClassName('dropmarker').setStyle({position:'absolute'});
      document.getElementsByTagName("body").item(0).appendChild(Sortable._marker);
    }
    var offsets = dropon.cumulativeOffset();
    Sortable._marker.setStyle({left: offsets[0]+'px', top: offsets[1] + 'px'});

    if(position=='after')
      if(sortable.overlap == 'horizontal')
        Sortable._marker.setStyle({left: (offsets[0]+dropon.clientWidth) + 'px'});
      else
        Sortable._marker.setStyle({top: (offsets[1]+dropon.clientHeight) + 'px'});

    Sortable._marker.show();
  },

  _tree: function(element, options, parent) {
    var children = Sortable.findElements(element, options) || [];

    for (var i = 0; i < children.length; ++i) {
      var match = children[i].id.match(options.format);

      if (!match) continue;

      var child = {
        id: encodeURIComponent(match ? match[1] : null),
        element: element,
        parent: parent,
        children: [],
        position: parent.children.length,
        container: $(children[i]).down(options.treeTag)
      };

      /* Get the element containing the children and recurse over it */
      if (child.container)
        this._tree(child.container, options, child);

      parent.children.push (child);
    }

    return parent;
  },

  tree: function(element) {
    element = $(element);
    var sortableOptions = this.options(element);
    var options = Object.extend({
      tag: sortableOptions.tag,
      treeTag: sortableOptions.treeTag,
      only: sortableOptions.only,
      name: element.id,
      format: sortableOptions.format
    }, arguments[1] || { });

    var root = {
      id: null,
      parent: null,
      children: [],
      container: element,
      position: 0
    };

    return Sortable._tree(element, options, root);
  },

  /* Construct a [i] index for a particular node */
  _constructIndex: function(node) {
    var index = '';
    do {
      if (node.id) index = '[' + node.position + ']' + index;
    } while ((node = node.parent) != null);
    return index;
  },

  sequence: function(element) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[1] || { });

    return $(this.findElements(element, options) || []).map( function(item) {
      return item.id.match(options.format) ? item.id.match(options.format)[1] : '';
    });
  },

  setSequence: function(element, new_sequence) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[2] || { });

    var nodeMap = { };
    this.findElements(element, options).each( function(n) {
        if (n.id.match(options.format))
            nodeMap[n.id.match(options.format)[1]] = [n, n.parentNode];
        n.parentNode.removeChild(n);
    });

    new_sequence.each(function(ident) {
      var n = nodeMap[ident];
      if (n) {
        n[1].appendChild(n[0]);
        delete nodeMap[ident];
      }
    });
  },

  serialize: function(element) {
    element = $(element);
    var options = Object.extend(Sortable.options(element), arguments[1] || { });
    var name = encodeURIComponent(
      (arguments[1] && arguments[1].name) ? arguments[1].name : element.id);

    if (options.tree) {
      return Sortable.tree(element, arguments[1]).children.map( function (item) {
        return [name + Sortable._constructIndex(item) + "[id]=" +
                encodeURIComponent(item.id)].concat(item.children.map(arguments.callee));
      }).flatten().join('&');
    } else {
      return Sortable.sequence(element, arguments[1]).map( function(item) {
        return name + "[]=" + encodeURIComponent(item);
      }).join('&');
    }
  }
};

Element.isParent = function(child, element) {
  if (!child.parentNode || child == element) return false;
  if (child.parentNode == element) return true;
  return Element.isParent(child.parentNode, element);
};

Element.findChildren = function(element, only, recursive, tagName) {
  if(!element.hasChildNodes()) return null;
  tagName = tagName.toUpperCase();
  if(only) only = [only].flatten();
  var elements = [];
  $A(element.childNodes).each( function(e) {
    if(e.tagName && e.tagName.toUpperCase()==tagName &&
      (!only || (Element.classNames(e).detect(function(v) { return only.include(v) }))))
        elements.push(e);
    if(recursive) {
      var grandchildren = Element.findChildren(e, only, recursive, tagName);
      if(grandchildren) elements.push(grandchildren);
    }
  });

  return (elements.length>0 ? elements.flatten() : []);
};

Element.offsetSize = function (element, type) {
  return element['offset' + ((type=='vertical' || type=='height') ? 'Height' : 'Width')];
};


Sound = {
  tracks: {},
  _enabled: true,
  template:
    new Template('<embed style="height:0" id="sound_#{track}_#{id}" src="#{url}" loop="false" autostart="true" hidden="true"/>'),
  enable: function(){
    Sound._enabled = true;
  },
  disable: function(){
    Sound._enabled = false;
  },
  play: function(url){
    if(!Sound._enabled) return;
    var options = Object.extend({
      track: 'global', url: url, replace: false
    }, arguments[1] || {});

    if(options.replace && this.tracks[options.track]) {
      $R(0, this.tracks[options.track].id).each(function(id){
        var sound = $('sound_'+options.track+'_'+id);
        sound.Stop && sound.Stop();
        sound.remove();
      });
      this.tracks[options.track] = null;
    }

    if(!this.tracks[options.track])
      this.tracks[options.track] = { id: 0 };
    else
      this.tracks[options.track].id++;

    options.id = this.tracks[options.track].id;
    $$('body')[0].insert(
      Prototype.Browser.IE ? new Element('bgsound',{
        id: 'sound_'+options.track+'_'+options.id,
        src: options.url, loop: 1, autostart: true
      }) : Sound.template.evaluate(options));
  }
};

if(Prototype.Browser.Gecko && navigator.userAgent.indexOf("Win") > 0){
  if(navigator.plugins && $A(navigator.plugins).detect(function(p){ return p.name.indexOf('QuickTime') != -1 }))
    Sound.template = new Template('<object id="sound_#{track}_#{id}" width="0" height="0" type="audio/mpeg" data="#{url}"/>');
  else if(navigator.plugins && $A(navigator.plugins).detect(function(p){ return p.name.indexOf('Windows Media') != -1 }))
    Sound.template = new Template('<object id="sound_#{track}_#{id}" type="application/x-mplayer2" data="#{url}"></object>');
  else if(navigator.plugins && $A(navigator.plugins).detect(function(p){ return p.name.indexOf('RealPlayer') != -1 }))
    Sound.template = new Template('<embed type="audio/x-pn-realaudio-plugin" style="height:0" id="sound_#{track}_#{id}" src="#{url}" loop="false" autostart="true" hidden="true"/>');
  else
    Sound.play = function(){};
}
/*
  mustache.js â€” Logic-less templates in JavaScript

  See http://mustache.github.com/ for more info.
*/

var Mustache = function() {
  var Renderer = function() {};

  Renderer.prototype = {
    otag: "{{",
    ctag: "}}",
    pragmas: {},
    buffer: [],
    pragmas_implemented: {
      "IMPLICIT-ITERATOR": true
    },
    context: {},

    render: function(template, context, partials, in_recursion) {
      if(!in_recursion) {
        this.context = context;
        this.buffer = []; // TODO: make this non-lazy
      }

      if(!this.includes("", template)) {
        if(in_recursion) {
          return template;
        } else {
          this.send(template);
          return;
        }
      }

      template = this.render_pragmas(template);
      var html = this.render_section(template, context, partials);
      if(in_recursion) {
        return this.render_tags(html, context, partials, in_recursion);
      }

      this.render_tags(html, context, partials, in_recursion);
    },

    /*
      Sends parsed lines
    */
    send: function(line) {
      if(line != "") {
        this.buffer.push(line);
      }
    },

    /*
      Looks for %PRAGMAS
    */
    render_pragmas: function(template) {
      if(!this.includes("%", template)) {
        return template;
      }

      var that = this;
      var regex = new RegExp(this.otag + "%([\\w-]+) ?([\\w]+=[\\w]+)?" +
            this.ctag);
      return template.replace(regex, function(match, pragma, options) {
        if(!that.pragmas_implemented[pragma]) {
          throw({message:
            "This implementation of mustache doesn't understand the '" +
            pragma + "' pragma"});
        }
        that.pragmas[pragma] = {};
        if(options) {
          var opts = options.split("=");
          that.pragmas[pragma][opts[0]] = opts[1];
        }
        return "";
      });
    },

    /*
      Tries to find a partial in the curent scope and render it
    */
    render_partial: function(name, context, partials) {
      name = this.trim(name);
      if(!partials || partials[name] === undefined) {
        throw({message: "unknown_partial '" + name + "'"});
      }
      if(typeof(context[name]) != "object") {
        return this.render(partials[name], context, partials, true);
      }
      return this.render(partials[name], context[name], partials, true);
    },

    /*
      Renders inverted (^) and normal (#) sections
    */
    render_section: function(template, context, partials) {
      if(!this.includes("#", template) && !this.includes("^", template)) {
        return template;
      }

      var that = this;
      var regex = new RegExp(this.otag + "(\\^|\\#)\\s*(.+)\\s*" + this.ctag +
              "\n*([\\s\\S]+?)" + this.otag + "\\/\\s*\\2\\s*" + this.ctag +
              "\\s*", "mg");

      return template.replace(regex, function(match, type, name, content) {
        var value = that.find(name, context);
        if(type == "^") { // inverted section
          if(!value || that.is_array(value) && value.length === 0) {
            return that.render(content, context, partials, true);
          } else {
            return "";
          }
        } else if(type == "#") { // normal section
          if(that.is_array(value)) { // Enumerable, Let's loop!
            return that.map(value, function(row) {
              return that.render(content, that.create_context(row),
                partials, true);
            }).join("");
          } else if(that.is_object(value)) { // Object, Use it as subcontext!
            return that.render(content, that.create_context(value),
              partials, true);
          } else if(typeof value === "function") {
            return value.call(context, content, function(text) {
              return that.render(text, context, partials, true);
            });
          } else if(value) { // boolean section
            return that.render(content, context, partials, true);
          } else {
            return "";
          }
        }
      });
    },

    /*
      Replace {{foo}} and friends with values from our view
    */
    render_tags: function(template, context, partials, in_recursion) {
      var that = this;

      var new_regex = function() {
        return new RegExp(that.otag + "(=|!|>|\\{|%)?([^\\/#\\^]+?)\\1?" +
          that.ctag + "+", "g");
      };

      var regex = new_regex();
      var tag_replace_callback = function(match, operator, name) {
        switch(operator) {
        case "!": // ignore comments
          return "";
        case "=": // set new delimiters, rebuild the replace regexp
          that.set_delimiters(name);
          regex = new_regex();
          return "";
        case ">": // render partial
          return that.render_partial(name, context, partials);
        case "{": // the triple mustache is unescaped
          return that.find(name, context);
        default: // escape the value
          return that.escape(that.find(name, context));
        }
      };
      var lines = template.split("\n");
      for(var i = 0; i < lines.length; i++) {
        lines[i] = lines[i].replace(regex, tag_replace_callback, this);
        if(!in_recursion) {
          this.send(lines[i]);
        }
      }

      if(in_recursion) {
        return lines.join("\n");
      }
    },

    set_delimiters: function(delimiters) {
      var dels = delimiters.split(" ");
      this.otag = this.escape_regex(dels[0]);
      this.ctag = this.escape_regex(dels[1]);
    },

    escape_regex: function(text) {
      if(!arguments.callee.sRE) {
        var specials = [
          '/', '.', '*', '+', '?', '|',
          '(', ')', '[', ']', '{', '}', '\\'
        ];
        arguments.callee.sRE = new RegExp(
          '(\\' + specials.join('|\\') + ')', 'g'
        );
      }
      return text.replace(arguments.callee.sRE, '\\$1');
    },

    /*
      find `name` in current `context`. That is find me a value
      from the view object
    */
    find: function(name, context) {
      name = this.trim(name);

      function is_kinda_truthy(bool) {
        return bool === false || bool === 0 || bool;
      }

      var value;
      if(is_kinda_truthy(context[name])) {
        value = context[name];
      } else if(is_kinda_truthy(this.context[name])) {
        value = this.context[name];
      }

      if(typeof value === "function") {
        return value.apply(context);
      }
      if(value !== undefined) {
        return value;
      }
      return "";
    },


    /* includes tag */
    includes: function(needle, haystack) {
      return haystack.indexOf(this.otag + needle) != -1;
    },

    /*
      Does away with nasty characters
    */
    escape: function(s) {
      s = String(s === null ? "" : s);
      return s.replace(/&(?!\w+;)|["<>\\]/g, function(s) {
        switch(s) {
        case "&": return "&amp;";
        case "\\": return "\\\\";
        case '"': return '\"';
        case "<": return "&lt;";
        case ">": return "&gt;";
        default: return s;
        }
      });
    },

    create_context: function(_context) {
      if(this.is_object(_context)) {
        return _context;
      } else {
        var iterator = ".";
        if(this.pragmas["IMPLICIT-ITERATOR"]) {
          iterator = this.pragmas["IMPLICIT-ITERATOR"].iterator;
        }
        var ctx = {};
        ctx[iterator] = _context;
        return ctx;
      }
    },

    is_object: function(a) {
      return a && typeof a == "object";
    },

    is_array: function(a) {
      return Object.prototype.toString.call(a) === '[object Array]';
    },

    /*
      Gets rid of leading and trailing whitespace
    */
    trim: function(s) {
      return s.replace(/^\s*|\s*$/g, "");
    },

    /*
      Why, why, why? Because IE. Cry, cry cry.
    */
    map: function(array, fn) {
      if (typeof array.map == "function") {
        return array.map(fn);
      } else {
        var r = [];
        var l = array.length;
        for(var i = 0; i < l; i++) {
          r.push(fn(array[i]));
        }
        return r;
      }
    }
  };

  return({
    name: "mustache.js",
    version: "0.3.1-dev",

    /*
      Turns a template and view into HTML
    */
    to_html: function(template, view, partials, send_fun) {
      var renderer = new Renderer();
      if(send_fun) {
        renderer.send = send_fun;
      }
      renderer.render(template, view, partials);
      if(!send_fun) {
        return renderer.buffer.join("\n");
      }
    }
  });
}();
var route = window.location.hash.split("#!")[1]
if(route) {
  window.location = unescape(route)
}

pushHistoryState = function(route) {
  if (window.history && window.history.pushState) {
    window.history.pushState({path: route}, "Teambox", route)
  } else {
    window.location.hash = "!" + escape(route)
  }
}


Element.addMethods({
  purgeChildren: function(element) { $A(element.childNodes).each(function(e){$(e).remove();}); },
  build: function(element, type, options, style) {
    var newElement = Element.buildAndAppend(type, options, style);
    element.appendChild(newElement);
    return newElement;
  }
});

Element.buildAndAppend = function(type, options, style)
{
  var e = $(document.createElement(type));
  $H(options).each(function(pair) { e[pair.key] = pair.value });
  if (style) e.setStyle(style);
  return e;
};
nil = null;

Date.one_day = 24*60*60*1000;
Date.weekdays = $w("S M T W T F S");
Date.first_day_of_week = 0;
Date.months = $w("January February March April May June July August September October November December" );
Date.padded2 = function(hour) { padded2 = hour.toString(); if ((parseInt(hour) < 10) || (parseInt(hour) == null)) padded2="0" + padded2; return padded2; }
Date.prototype.getPaddedMinutes = function() { return Date.padded2(this.getMinutes()); }
Date.prototype.getAMPMHour = function() { hour=Date.padded2(this.getHours()); return (hour == null) ? 00 : (hour > 24 ? hour - 24 : hour ) }
Date.prototype.getAMPM = function() { return (this.getHours() < 12) ? "" : ""; }
Date.prototype.stripTime = function() { return new Date(this.getFullYear(), this.getMonth(), this.getDate());};
Date.prototype.daysDistance = function(compare_date) { return Math.round((compare_date - this) / Date.one_day); };
Date.prototype.toFormattedString = function(include_time){
  str = this.getFullYear() + "-" + (this.getMonth() + 1) + "-" + Date.padded2(this.getDate());
  if (include_time) { hour=this.getHours(); str += " " + this.getAMPMHour() + ":" + this.getPaddedMinutes() }
  return str;
}
Date.parseFormattedString = function (string) {
  var regexp = '([0-9]{4})-(([0-9]{1,2})-(([0-9]{1,2})( ([0-9]{1,2}):([0-9]{2})? *)?)?)?';
  var d = string.match(new RegExp(regexp, "i"));
  if (d==null) return Date.parse(string); // at least give javascript a crack at it.
  var offset = 0;
  var date = new Date(d[1], 0, 1);
  if (d[3]) { date.setMonth(d[3] - 1); }
  if (d[5]) { date.setDate(d[5]); }
  if (d[7]) {
    date.setHours(parseInt(d[7], 10));
  }
  if (d[8]) { date.setMinutes(d[8]); }
  if (d[10]) { date.setSeconds(d[10]); }
  return date;
}
Math.floor_to_interval = function(n, i) { return Math.floor(n/i) * i;}
window.f_height = function() { return( [window.innerHeight ? window.innerHeight : null, document.documentElement ? document.documentElement.clientHeight : null, document.body ? document.body.clientHeight : null].select(function(x){return x>0}).first()||0); }
window.f_scrollTop = function() { return ([window.pageYOffset ? window.pageYOffset : null, document.documentElement ? document.documentElement.scrollTop : null, document.body ? document.body.scrollTop : null].select(function(x){return x>0}).first()||0 ); }

_translations = {
  "OK": "OK",
  "Now": "Now",
  "Today": "Today",
  "Clear": "Clear"
}
SelectBox = Class.create();
SelectBox.prototype = {
  initialize: function(parent_element, values, html_options, style_options) {
    this.element = $(parent_element).build("select", html_options, style_options);
    this.populate(values);
  },
  populate: function(values) {
    this.element.purgeChildren();
    var that = this; $A(values).each(function(pair) { if (typeof(pair)!="object") {pair = [pair, pair]}; that.element.build("option", { value: pair[1], innerHTML: pair[0]}) });
  },
  setValue: function(value) {
    var e = this.element;
    var matched = false;
    $R(0, e.options.length - 1 ).each(function(i) { if(e.options[i].value==value.toString()) {e.selectedIndex = i; matched = true;}; } );
    return matched;
  },
  getValue: function() { return $F(this.element)}
}
CalendarDateSelect = Class.create();
CalendarDateSelect.prototype = {
  initialize: function(target_element, options) {
    this.target_element = $(target_element); // make sure it's an element, not a string
    if (!this.target_element) { alert("Target element " + target_element + " not found!"); return false;}
    if (this.target_element.tagName != "INPUT") this.target_element = this.target_element.down("INPUT")

    this.target_element.calendar_date_select = this;
    this.last_click_at = 0;
    this.options = $H({
      embedded: false,
      popup: nil,
      time: false,
      buttons: true,
      clear_button: true,
      year_range: 10,
      close_on_click: nil,
      minute_interval: 5,
      popup_by: this.target_element,
      month_year: "dropdowns",
      onchange: function(target_element)
      { return function()
        { if(target_element.dispatchEvent)
          { var event=document.createEvent('HTMLEvents');
            event.initEvent('change', true, true);
            target_element.dispatchEvent(event);
          }
          else
          { var event=document.createEventObject();
            event.type='onChange';
            target_element.fireEvent('onChange', event);
          }
        };
      }(this.target_element),
      valid_date_check: nil
    }).merge(options || {});
    this.use_time = this.options.get("time");
    this.parseDate();
    this.callback("before_show")
    this.initCalendarDiv();
    if(!this.options.get("embedded")) {
      this.positionCalendarDiv()
      Event.observe(document, "mousedown", this.closeIfClickedOut_handler = this.closeIfClickedOut.bindAsEventListener(this));
      Event.observe(document, "keypress", this.keyPress_handler = this.keyPress.bindAsEventListener(this));
    }
    this.callback("after_show")
  },
  positionCalendarDiv: function() {
    var above = false;
    var c_pos = this.calendar_div.cumulativeOffset(), c_left = c_pos[0], c_top = c_pos[1], c_dim = this.calendar_div.getDimensions(), c_height = c_dim.height, c_width = c_dim.width;
    var w_top = window.f_scrollTop(), w_height = window.f_height();
    var e_dim = $(this.options.get("popup_by")).cumulativeOffset(), e_top = e_dim[1], e_left = e_dim[0], e_height = $(this.options.get("popup_by")).getDimensions().height, e_bottom = e_top + e_height;

    if ( (( e_bottom + c_height ) > (w_top + w_height)) && ( e_bottom - c_height > w_top )) above = true;
    var left_px = e_left.toString() + "px", top_px = (above ? (e_top - c_height ) : ( e_top + e_height )).toString() + "px";

    this.calendar_div.style.left = left_px;  this.calendar_div.style.top = top_px;

    this.calendar_div.setStyle({visibility:""});

    if(navigator.appName=="Microsoft Internet Explorer") this.iframe = $(document.body).build("iframe", {src: "javascript:false", className: "ie6_blocker"}, { left: left_px, top: top_px, height: c_height.toString()+"px", width: c_width.toString()+"px", border: "0px"})
  },
  initCalendarDiv: function() {
    if (this.options.get("embedded")) {
      var parent = this.target_element.parentNode;
      var style = {}
    } else {
      var parent = document.body
      var style = { position:"absolute", visibility: "hidden", left:0, top:0 }
    }
    this.calendar_div = $(parent).build('div', {className: "calendar_date_select"}, style);

    var that = this;
    $w("top header body buttons footer bottom").each(function(name) {
      eval("var " + name + "_div = that." + name + "_div = that.calendar_div.build('div', { className: 'cds_"+name+"' }, { clear: 'left'} ); ");
    });

    this.initHeaderDiv();
    this.initButtonsDiv();
    this.initCalendarGrid();
    this.updateFooter("&#160;");

    this.refresh();
    this.setUseTime(this.use_time);
  },
  initHeaderDiv: function() {
    var header_div = this.header_div;
    this.close_button = header_div.build("a", { innerHTML: "x", href:"#", onclick:function () { this.close(); return false; }.bindAsEventListener(this), className: "close" });
    this.next_month_button = header_div.build("a", { innerHTML: "&gt;", href:"#", onclick:function () { this.navMonth(this.date.getMonth() + 1 ); return false; }.bindAsEventListener(this), className: "next" });
    this.prev_month_button = header_div.build("a", { innerHTML: "&lt;", href:"#", onclick:function () { this.navMonth(this.date.getMonth() - 1 ); return false; }.bindAsEventListener(this), className: "prev" });

    if (this.options.get("month_year")=="dropdowns") {
      this.month_select = new SelectBox(header_div, $R(0,11).map(function(m){return [Date.months[m], m]}), {className: "month", onchange: function () { this.navMonth(this.month_select.getValue()) }.bindAsEventListener(this)});
      this.year_select = new SelectBox(header_div, [], {className: "year", onchange: function () { this.navYear(this.year_select.getValue()) }.bindAsEventListener(this)});
      this.populateYearRange();
    } else {
      this.month_year_label = header_div.build("span")
    }
  },
  initCalendarGrid: function() {
    var body_div = this.body_div;
    this.calendar_day_grid = [];
    var days_table = body_div.build("table", { cellPadding: "0px", cellSpacing: "0px", width: "100%" })
    var weekdays_row = days_table.build("thead").build("tr");
    Date.weekdays.each( function(weekday) {
      weekdays_row.build("th", {innerHTML: weekday});
    });

    var days_tbody = days_table.build("tbody")
    var row_number = 0, weekday;
    for(var cell_index = 0; cell_index<42; cell_index++)
    {
      weekday = (cell_index+Date.first_day_of_week ) % 7;
      if ( cell_index % 7==0 ) days_row = days_tbody.build("tr", {className: 'row_'+row_number++});
      (this.calendar_day_grid[cell_index] = days_row.build("td", {
          calendar_date_select: this,
          onmouseover: function () { this.calendar_date_select.dayHover(this); },
          onmouseout: function () { this.calendar_date_select.dayHoverOut(this) },
          onclick: function() { this.calendar_date_select.updateSelectedDate(this, true); },
          className: (weekday==0) || (weekday==6) ? " weekend" : "" //clear the class
        },
        { cursor: "pointer" }
      )).build("div");
      this.calendar_day_grid[cell_index];
    }
  },
  initButtonsDiv: function()
  {
    var buttons_div = this.buttons_div;
    if (this.options.get("time"))
    {
      var blank_time = $A(this.options.get("time")=="mixed" ? [[" - ", ""]] : []);
      buttons_div.build("span", {innerHTML:"@", className: "at_sign"});

      var t = new Date();
      this.hour_select = new SelectBox(buttons_div,
        blank_time.concat($R(0,23).map(function(x) {t.setHours(x); return $A([t.getAMPMHour()+ " " + t.getAMPM(),x])} )),
        {
          calendar_date_select: this,
          onchange: function() { this.calendar_date_select.updateSelectedDate( { hour: this.value });},
          className: "hour"
        }
      );
      buttons_div.build("span", {innerHTML:":", className: "seperator"});
      var that = this;
      this.minute_select = new SelectBox(buttons_div,
        blank_time.concat($R(0,59).select(function(x){return (x % that.options.get('minute_interval')==0)}).map(function(x){ return $A([ Date.padded2(x), x]); } ) ),
        {
          calendar_date_select: this,
          onchange: function() { this.calendar_date_select.updateSelectedDate( {minute: this.value }) },
          className: "minute"
        }
      );

    } else if (! this.options.get("buttons")) buttons_div.remove();

    if (this.options.get("buttons")) {
      buttons_div.build("span", {innerHTML: "&#160;"});
      if (this.options.get("time")=="mixed" || !this.options.get("time")) b = buttons_div.build("a", {
          innerHTML: _translations["Today"],
          href: "#",
          onclick: function() {this.today(false); return false;}.bindAsEventListener(this)
        });

      if (this.options.get("time")=="mixed") buttons_div.build("span", {innerHTML: "&#160;|&#160;", className:"button_seperator"})

      if (this.options.get("time")) b = buttons_div.build("a", {
        innerHTML: _translations["Now"],
        href: "#",
        onclick: function() {this.today(true); return false}.bindAsEventListener(this)
      });

      if (!this.options.get("embedded") && !this.closeOnClick())
      {
        buttons_div.build("span", {innerHTML: "&#160;|&#160;", className:"button_seperator"})
        buttons_div.build("a", { innerHTML: _translations["OK"], href: "#", onclick: function() {this.close(); return false;}.bindAsEventListener(this) });
      }
      if (this.options.get('clear_button')) {
        buttons_div.build("span", {innerHTML: "&#160;|&#160;", className:"button_seperator"})
        buttons_div.build("a", { innerHTML: _translations["Clear"], href: "#", onclick: function() {this.clearDate(); if (!this.options.get("embedded")) this.close(); return false;}.bindAsEventListener(this) });
      }
    }
  },
  refresh: function ()
  {
    this.refreshMonthYear();
    this.refreshCalendarGrid();

    this.setSelectedClass();
    this.updateFooter();
  },
  refreshCalendarGrid: function () {
    this.beginning_date = new Date(this.date).stripTime();
    this.beginning_date.setDate(1);
    this.beginning_date.setHours(12); // Prevent daylight savings time boundaries from showing a duplicate day
    var pre_days = this.beginning_date.getDay() // draw some days before the fact
    if (pre_days < 3) pre_days += 7;
    this.beginning_date.setDate(1 - pre_days + Date.first_day_of_week);

    var iterator = new Date(this.beginning_date);

    var today = new Date().stripTime();
    var this_month = this.date.getMonth();
    vdc = this.options.get("valid_date_check");
    for (var cell_index = 0;cell_index<42; cell_index++)
    {
      day = iterator.getDate(); month = iterator.getMonth();
      cell = this.calendar_day_grid[cell_index];
      Element.remove(cell.childNodes[0]); div = cell.build("div", {innerHTML:day});
      if (month!=this_month) div.className = "other";
      cell.day = day; cell.month = month; cell.year = iterator.getFullYear();
      if (vdc) { if (vdc(iterator.stripTime())) cell.removeClassName("disabled"); else cell.addClassName("disabled") };
      iterator.setDate( day + 1);
    }

    if (this.today_cell) this.today_cell.removeClassName("today");

    if ( $R( 0, 41 ).include(days_until = this.beginning_date.stripTime().daysDistance(today)) ) {
      this.today_cell = this.calendar_day_grid[days_until];
      this.today_cell.addClassName("today");
    }
  },
  refreshMonthYear: function() {
    var m = this.date.getMonth();
    var y = this.date.getFullYear();
    if (this.options.get("month_year") == "dropdowns")
    {
      this.month_select.setValue(m, false);

      var e = this.year_select.element;
      if (this.flexibleYearRange() && (!(this.year_select.setValue(y, false)) || e.selectedIndex <= 1 || e.selectedIndex >= e.options.length - 2 )) this.populateYearRange();

      this.year_select.setValue(y);

    } else {
      this.month_year_label.update().insert(Date.months[m] + " " + y.toString());
    }
  },
  populateYearRange: function() {
    this.year_select.populate(this.yearRange().toArray());
  },
  yearRange: function() {
    if (!this.flexibleYearRange())
      return $R(this.options.get("year_range")[0], this.options.get("year_range")[1]);

    var y = this.date.getFullYear();
    return $R(y - this.options.get("year_range"), y + this.options.get("year_range"));
  },
  flexibleYearRange: function() { return (typeof(this.options.get("year_range")) == "number"); },
  validYear: function(year) { if (this.flexibleYearRange()) { return true;} else { return this.yearRange().include(year);}  },
  dayHover: function(element) {
    var hover_date = new Date(this.selected_date);
    hover_date.setFullYear(element.year, element.month, element.day);
    this.updateFooter(hover_date.toFormattedString(this.use_time));
  },
  dayHoverOut: function(element) { this.updateFooter(); },
  clearSelectedClass: function() {if (this.selected_cell) this.selected_cell.removeClassName("selected");},
  setSelectedClass: function() {
    if (!this.selection_made) return;
    this.clearSelectedClass()
    if ($R(0,42).include( days_until = this.beginning_date.stripTime().daysDistance(this.selected_date.stripTime()) )) {
      this.selected_cell = this.calendar_day_grid[days_until];
      this.selected_cell.addClassName("selected");
    }
  },
  reparse: function() { this.parseDate(); this.refresh(); },
  dateString: function() {
    return (this.selection_made) ? this.selected_date.toFormattedString(this.use_time) : "&#160;";
  },
  parseDate: function()
  {
    var value = $F(this.target_element).strip()
    var default_time = this.options.get("default_time");
    this.selection_made = (value != "" || default_time);
    this.date = value=="" ? NaN : Date.parseFormattedString(this.options.get("date") || value);
    if (isNaN(this.date) && !default_time)
        this.date = new Date();
    else if (isNaN(this.date) && default_time)
        this.date = (Object.prototype.toString.apply(default_time) === '[object Function]') ? default_time() : default_time;

    if (!this.validYear(this.date.getFullYear())) this.date.setYear( (this.date.getFullYear() < this.yearRange().start) ? this.yearRange().start : this.yearRange().end);
    this.selected_date = new Date(this.date);
    this.use_time = /[0-9]:[0-9]{2}/.exec(value) ? true : false;
    this.date.setDate(1);
  },
  updateFooter:function(text) { if (!text) text = this.dateString(); this.footer_div.purgeChildren(); this.footer_div.build("span", {innerHTML: text }); },
  clearDate:function() {
    if ((this.target_element.disabled || this.target_element.readOnly) && this.options.get("popup") != "force") return false;
    var last_value = this.target_element.value;
    this.target_element.value = "";
    this.clearSelectedClass();
    this.updateFooter('&#160;');
    if (last_value!=this.target_element.value) this.callback("onchange");
  },
  updateSelectedDate:function(partsOrElement, via_click) {
    var parts = $H(partsOrElement);
    if ((this.target_element.disabled || this.target_element.readOnly) && this.options.get("popup") != "force") return false;
    if (parts.get("day")) {
      var t_selected_date = this.selected_date, vdc = this.options.get("valid_date_check");
      t_selected_date.setFullYear(parts.get("year"), parts.get("month"), parts.get("day"));

      if (vdc && ! vdc(t_selected_date.stripTime())) { return false; }
      this.selected_date = t_selected_date;
      this.selection_made = true;
    }

    if (!isNaN(parts.get("hour"))) this.selected_date.setHours(parts.get("hour"));
    if (!isNaN(parts.get("minute"))) this.selected_date.setMinutes( Math.floor_to_interval(parts.get("minute"), this.options.get("minute_interval")) );
    if (parts.get("hour") === "" || parts.get("minute") === "")
      this.setUseTime(false);
    else if (!isNaN(parts.get("hour")) || !isNaN(parts.get("minute")))
      this.setUseTime(true);

    this.updateFooter();
    this.setSelectedClass();

    if (this.selection_made) this.updateValue();
    if (this.closeOnClick()) { this.close(); }
    if (via_click && !this.options.get("embedded")) {
      if ((new Date() - this.last_click_at) < 333) this.close();
      this.last_click_at = new Date();
    }
  },
  closeOnClick: function() {
    if (this.options.get("embedded")) return false;
    if (this.options.get("close_on_click")===nil )
      return (this.options.get("time")) ? false : true
    else
      return (this.options.get("close_on_click"))
  },
  navMonth: function(month) { (target_date = new Date(this.date)).setMonth(month); return (this.navTo(target_date)); },
  navYear: function(year) { (target_date = new Date(this.date)).setYear(year); return (this.navTo(target_date)); },
  navTo: function(date) {
    if (!this.validYear(date.getFullYear())) return false;
    this.date = date;
    this.date.setDate(1);
    this.refresh();
    this.callback("after_navigate", this.date);
    return true;
  },
  setUseTime: function(turn_on) {
    this.use_time = this.options.get("time") && (this.options.get("time")=="mixed" ? turn_on : true) // force use_time to true if time==true && time!="mixed"
    if (this.use_time && this.selected_date) { // only set hour/minute if a date is already selected
      var minute = Math.floor_to_interval(this.selected_date.getMinutes(), this.options.get("minute_interval"));
      var hour = this.selected_date.getHours();

      this.hour_select.setValue(hour);
      this.minute_select.setValue(minute)
    } else if (this.options.get("time")=="mixed") {
      this.hour_select.setValue(""); this.minute_select.setValue("");
    }
  },
  updateValue: function() {
    var last_value = this.target_element.value;
    this.target_element.value = this.dateString();
    if (last_value!=this.target_element.value) this.callback("onchange");
  },
  today: function(now) {
    var d = new Date(); this.date = new Date();
    var o = $H({ day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes()});
    if ( ! now ) o = o.merge({hour: "", minute:""});
    this.updateSelectedDate(o, true);
    this.refresh();
  },
  close: function() {
    if (this.closed) return false;
    this.callback("before_close");
    this.target_element.calendar_date_select = nil;
    Event.stopObserving(document, "mousedown", this.closeIfClickedOut_handler);
    Event.stopObserving(document, "keypress", this.keyPress_handler);
    this.calendar_div.remove(); this.closed = true;
    if (this.iframe) this.iframe.remove();
    if (this.target_element.type != "hidden" && ! this.target_element.disabled) this.target_element.focus();
    this.callback("after_close");
  },
  closeIfClickedOut: function(e) {
    if (! $(Event.element(e)).descendantOf(this.calendar_div) ) this.close();
  },
  keyPress: function(e) {
    if (e.keyCode==Event.KEY_ESC) this.close();
  },
  callback: function(name, param) { if (this.options.get(name)) { this.options.get(name).bind(this.target_element)(param); } }
}
;(function(){
  var element, imageMaxWidth = 700, imageMaxHeight = 300, screenMinWidth = 75

  Facebox = {
    open: function(html, classname, extra) {
      classname || (classname = 'html')
      element.down('.facebox-wrapper').setStyle({ width: '' }).className = 'facebox-wrapper ' + classname
      var content = element.down('.facebox-content').update(html)
      var default_close = [{className: 'close', href:'#close', description: 'Close'}]
      if (extra)
        setExtras(extra.buttons || default_close, extra.description)
      else
        setExtras(default_close, '')
      element.setStyle({ display: 'block' })
      if (classname == 'loading') content.fire('facebox:loading')
      else content.fire('facebox:opened', { type: classname })
    },
    openImage: function(src, alt) {
      this.open('Loading image ...', 'loading')
      var image = new Image()
      image.onload = function() {
        this.open('<a href="' + src + '"><img src="' + src + '"></a>', 'image', alt)
        var img = element.down('.facebox-content img'),
            screenWidth = Math.max(Math.min(image.width, imageMaxWidth), screenMinWidth)

        img.setStyle({ maxWidth:imageMaxWidth+'px', maxHeight:imageMaxHeight+'px' })
        element.down('.facebox-wrapper').setStyle({ width: screenWidth+'px' })
      }.bind(this)
      image.src = src
    },
    openUrl: function(url, extra) {
      this.open('Loading ...', 'loading')
      new Ajax.Request(url, {
        method: 'get',
        onSuccess: function(response) {
          this.open(response.responseText)
        }.bind(this),
        onFailure: function(response) {
          this.open('<br/><p>There has been an error.</p>', 'error')
        }.bind(this)
      })
    },
    close: function() {
      if (element.getStyle('display') == 'block') {
        element.hide().fire('facebox:closed')
      }
    }
  }

  var setElement = function(fn) {
    $(document.body).insert({ bottom: "<div id='facebox' style='display: none'>\
      <div class='facebox-wrapper html'>\
        <div class='facebox-container'>\
          <div class='facebox-content'></div>\
          <div class='facebox-extra'></div>\
        </div></div></div>"
      })
    element = $('facebox')
    if (element && fn) fn(element)
  }

  var setExtras = function(buttons, description) {
    var items = ["<p class='description'>" + (description ? description : '') + "</p>", "<div class=\'buttons'>"]
    buttons.each(function(button){
      items.push("<a class='facebutton " + button.className + "' href='" + button.href + "' " +
                 (button.extra||'') + ">" + button.description + "</a>")
    })
    items.push('</div>')
    element.down('.facebox-extra').update(items.join(''))
  }

  document.on('dom:loaded', function() {
    setElement(function(box) {
      box.on('click', function(e) {
        if (e.findElement('.facebox-extra .close') || !e.findElement('.facebox-wrapper')) {
          e.preventDefault()
          Facebox.close()
        }
      })
      document.on('keyup', function(e) {
        if (e.keyCode == Event.KEY_ESC) Facebox.close()
      })
      document.on('click', 'a[href][rel=facebox]', function(e) {
        if (e.isMiddleClick()) return

        var el = e.findElement('a'),
            href = el.readAttribute('href'),
            extra = el.readAttribute('title')

        e.preventDefault()

        if (/^#(.+)/.test(href)) {
          var source = $(RegExp.$1)
          if (source) Facebox.open(source.innerHTML, 'html', {description: extra})
        }
        else if (/\.(png|gif|jpe?g|bmp|tif?f)(\?|$)/i.test(href)) {
          Facebox.openImage(href, extra)
        }
        else {
          Facebox.openUrl(href, extra)
        }
      })
    })
  })

  Prototype.Facebox = Facebox
})()








var Showdown = {};

Showdown.converter = function() {


var g_urls;
var g_titles;
var g_html_blocks;

var g_list_level = 0;


this.makeHtml = function(text) {

	g_urls = new Array();
	g_titles = new Array();
	g_html_blocks = new Array();

	text = text.replace(/~/g,"~T");

	text = text.replace(/\$/g,"~D");

	text = text.replace(/\r\n/g,"\n"); // DOS to Unix
	text = text.replace(/\r/g,"\n"); // Mac to Unix

	text = "\n\n" + text + "\n\n";

	text = _Detab(text);

	text = text.replace(/^[ \t]+$/mg,"");

	text = _HashHTMLBlocks(text);

	text = _StripLinkDefinitions(text);

	text = _RunBlockGamut(text);

	text = _UnescapeSpecialChars(text);

	text = text.replace(/~D/g,"$$");

	text = text.replace(/~T/g,"~");

  text = text.replace(/https?\:\/\/[^"\s\<\>]*[^.,;'">\:\s\<\>\)\]\!]/g, function(wholeMatch,matchIndex){
    var left = text.slice(0, matchIndex), right = text.slice(matchIndex)
    if (left.match(/<[^>]+$/) && right.match(/^[^>]*>/)) {return wholeMatch}
    return "<a href='" + wholeMatch + "'>" + wholeMatch + "</a>";
  });
  text = text.replace(/[a-z0-9_\-+=.]+@[a-z0-9\-]+(\.[a-z0-9-]+)+/ig, function(wholeMatch){return "<a href='mailto:" + wholeMatch + "'>" + wholeMatch + "</a>";});

	return text;
}

var _StripLinkDefinitions = function(text) {


	/*
		var text = text.replace(/
				^[ ]{0,3}\[(.+)\]:  // id = $1  attacklab: g_tab_width - 1
				  [ \t]*
				  \n?				// maybe *one* newline
				  [ \t]*
				<?(\S+?)>?			// url = $2
				  [ \t]*
				  \n?				// maybe one newline
				  [ \t]*
				(?:
				  (\n*)				// any lines skipped = $3 attacklab: lookbehind removed
				  ["(]
				  (.+?)				// title = $4
				  [")]
				  [ \t]*
				)?					// title is optional
				(?:\n+|$)
			  /gm,
			  function(){...});
	*/
	var text = text.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,
		function (wholeMatch,m1,m2,m3,m4) {
			m1 = m1.toLowerCase();
			g_urls[m1] = _EncodeAmpsAndAngles(m2);  // Link IDs are case-insensitive
			if (m3) {
				return m3+m4;
			} else if (m4) {
				g_titles[m1] = m4.replace(/"/g,"&quot;");
			}

			return "";
		}
	);

	return text;
}


var _HashHTMLBlocks = function(text) {
	text = text.replace(/\n/g,"\n\n");

	var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del"
	var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math"


	/*
		var text = text.replace(/
		(						// save in $1
			^					// start of line  (with /m)
			<($block_tags_a)	// start tag = $2
			\b					// word break
			[^\r]*?\n			// any number of lines, minimally matching
			</\2>				// the matching end tag
			[ \t]*				// trailing spaces/tabs
			(?=\n+)				// followed by a newline
		)						// attacklab: there are sentinel newlines at end of document
		/gm,function(){...}};
	*/
	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm,hashElement);


	/*
		var text = text.replace(/
		(						// save in $1
			^					// start of line  (with /m)
			<($block_tags_b)	// start tag = $2
			\b					// word break
			[^\r]*?				// any number of lines, minimally matching
			.*</\2>				// the matching end tag
			[ \t]*				// trailing spaces/tabs
			(?=\n+)				// followed by a newline
		)						// attacklab: there are sentinel newlines at end of document
		/gm,function(){...}};
	*/
	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm,hashElement);


	/*
		text = text.replace(/
		(						// save in $1
			\n\n				// Starting after a blank line
			[ ]{0,3}
			(<(hr)				// start tag = $2
			\b					// word break
			([^<>])*?			//
			\/?>)				// the matching end tag
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,hashElement);


	/*
		text = text.replace(/
		(						// save in $1
			\n\n				// Starting after a blank line
			[ ]{0,3}			// attacklab: g_tab_width - 1
			<!
			(--[^\r]*?--\s*)+
			>
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g,hashElement);


	/*
		text = text.replace(/
		(?:
			\n\n				// Starting after a blank line
		)
		(						// save in $1
			[ ]{0,3}			// attacklab: g_tab_width - 1
			(?:
				<([?%])			// $2
				[^\r]*?
				\2>
			)
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,hashElement);

	text = text.replace(/\n\n/g,"\n");
	return text;
}

var hashElement = function(wholeMatch,m1) {
	var blockText = m1;

	blockText = blockText.replace(/\n\n/g,"\n");
	blockText = blockText.replace(/^\n/,"");

	blockText = blockText.replace(/\n+$/g,"");

	blockText = "\n\n~K" + (g_html_blocks.push(blockText)-1) + "K\n\n";

	return blockText;
};

var _RunBlockGamut = function(text) {
	text = _DoHeaders(text);

	var key = hashBlock("<hr />");
	text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,key);
	text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,key);
	text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,key);

	text = _DoLists(text);
	text = _DoCodeBlocks(text);
	text = _DoBlockQuotes(text);

	text = _HashHTMLBlocks(text);
	text = _FormParagraphs(text);

	return text;
}


var _RunSpanGamut = function(text) {

	text = _DoCodeSpans(text);
	text = _EscapeSpecialCharsWithinTagAttributes(text);
	text = _EncodeBackslashEscapes(text);

	text = _DoImages(text);
	text = _DoAnchors(text);

	text = _DoAutoLinks(text);
	text = _EncodeAmpsAndAngles(text);
	text = _DoItalicsAndBold(text);

	text = text.replace(/  +\n/g," <br />\n");

	return text;
}

var _EscapeSpecialCharsWithinTagAttributes = function(text) {

	var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;

	text = text.replace(regex, function(wholeMatch) {
		var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g,"$1`");
		tag = escapeCharacters(tag,"\\`*_");
		return tag;
	});

	return text;
}

var _DoAnchors = function(text) {

	/*
		text = text.replace(/
		(							// wrap whole match in $1
			\[
			(
				(?:
					\[[^\]]*\]		// allow brackets nested one level
					|
					[^\[]			// or anything else
				)*
			)
			\]

			[ ]?					// one optional space
			(?:\n[ ]*)?				// one optional newline followed by spaces

			\[
			(.*?)					// id = $3
			\]
		)()()()()					// pad remaining backreferences
		/g,_DoAnchors_callback);
	*/
	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeAnchorTag);


	/*
		text = text.replace(/
			(						// wrap whole match in $1
				\[
				(
					(?:
						\[[^\]]*\]	// allow brackets nested one level
					|
					[^\[\]]			// or anything else
				)
			)
			\]
			\(						// literal paren
			[ \t]*
			()						// no id, so leave $3 empty
			<?(.*?)>?				// href = $4
			[ \t]*
			(						// $5
				(['"])				// quote char = $6
				(.*?)				// Title = $7
				\6					// matching quote
				[ \t]*				// ignore any spaces/tabs between closing quote and )
			)?						// title is optional
			\)
		)
		/g,writeAnchorTag);
	*/
	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeAnchorTag);


	/*
		text = text.replace(/
		(		 					// wrap whole match in $1
			\[
			([^\[\]]+)				// link text = $2; can't contain '[' or ']'
			\]
		)()()()()()					// pad rest of backreferences
		/g, writeAnchorTag);
	*/
	text = text.replace(/(\[([^\[\]]+)\])()()()()()/g, writeAnchorTag);

	return text;
}

var writeAnchorTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
	if (m7 == undefined) m7 = "";
	var whole_match = m1;
	var link_text   = m2;
	var link_id	 = m3.toLowerCase();
	var url		= m4;
	var title	= m7;

	if (url == "") {
		if (link_id == "") {
			link_id = link_text.toLowerCase().replace(/ ?\n/g," ");
		}
		url = "#"+link_id;

		if (g_urls[link_id] != undefined) {
			url = g_urls[link_id];
			if (g_titles[link_id] != undefined) {
				title = g_titles[link_id];
			}
		}
		else {
			if (whole_match.search(/\(\s*\)$/m)>-1) {
				url = "";
			} else {
				return whole_match;
			}
		}
	}

	url = escapeCharacters(url,"*_");
	var result = "<a href=\"" + url + "\"";

	if (title != "") {
		title = title.replace(/"/g,"&quot;");
		title = escapeCharacters(title,"*_");
		result +=  " title=\"" + title + "\"";
	}

	result += ">" + link_text + "</a>";

	return result;
}


var _DoImages = function(text) {


	/*
		text = text.replace(/
		(						// wrap whole match in $1
			!\[
			(.*?)				// alt text = $2
			\]

			[ ]?				// one optional space
			(?:\n[ ]*)?			// one optional newline followed by spaces

			\[
			(.*?)				// id = $3
			\]
		)()()()()				// pad rest of backreferences
		/g,writeImageTag);
	*/
	text = text.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeImageTag);


	/*
		text = text.replace(/
		(						// wrap whole match in $1
			!\[
			(.*?)				// alt text = $2
			\]
			\s?					// One optional whitespace character
			\(					// literal paren
			[ \t]*
			()					// no id, so leave $3 empty
			<?(\S+?)>?			// src url = $4
			[ \t]*
			(					// $5
				(['"])			// quote char = $6
				(.*?)			// title = $7
				\6				// matching quote
				[ \t]*
			)?					// title is optional
		\)
		)
		/g,writeImageTag);
	*/
	text = text.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeImageTag);

	return text;
}

var writeImageTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
	var whole_match = m1;
	var alt_text   = m2;
	var link_id	 = m3.toLowerCase();
	var url		= m4;
	var title	= m7;

	if (!title) title = "";

	if (url == "") {
		if (link_id == "") {
			link_id = alt_text.toLowerCase().replace(/ ?\n/g," ");
		}
		url = "#"+link_id;

		if (g_urls[link_id] != undefined) {
			url = g_urls[link_id];
			if (g_titles[link_id] != undefined) {
				title = g_titles[link_id];
			}
		}
		else {
			return whole_match;
		}
	}

	alt_text = alt_text.replace(/"/g,"&quot;");
	url = escapeCharacters(url,"*_");
	var result = "<img src=\"" + url + "\" alt=\"" + alt_text + "\"";


		title = title.replace(/"/g,"&quot;");
		title = escapeCharacters(title,"*_");
		result +=  " title=\"" + title + "\"";

	result += " />";

	return result;
}


var _DoHeaders = function(text) {

	text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,
		function(wholeMatch,m1){return hashBlock("<h1>" + _RunSpanGamut(m1) + "</h1>");});

	text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,
		function(matchFound,m1){return hashBlock("<h2>" + _RunSpanGamut(m1) + "</h2>");});


	/*
		text = text.replace(/
			^(\#{1,6})				// $1 = string of #'s
			[ \t]*
			(.+?)					// $2 = Header text
			[ \t]*
			\#*						// optional closing #'s (not counted)
			\n+
		/gm, function() {...});
	*/

	text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,
		function(wholeMatch,m1,m2) {
			var h_level = m1.length;
			return hashBlock("<h" + h_level + ">" + _RunSpanGamut(m2) + "</h" + h_level + ">");
		});

	return text;
}

var _ProcessListItems;

var _DoLists = function(text) {

	text += "~0";


	/*
		var whole_list = /
		(									// $1 = whole list
			(								// $2
				[ ]{0,3}					// attacklab: g_tab_width - 1
				([*+-]|\d+[.])				// $3 = first list item marker
				[ \t]+
			)
			[^\r]+?
			(								// $4
				~0							// sentinel for workaround; should be $
			|
				\n{2,}
				(?=\S)
				(?!							// Negative lookahead for another list item marker
					[ \t]*
					(?:[*+-]|\d+[.])[ \t]+
				)
			)
		)/g
	*/
	var whole_list = /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;

	if (g_list_level) {
		text = text.replace(whole_list,function(wholeMatch,m1,m2) {
			var list = m1;
			var list_type = (m2.search(/[*+-]/g)>-1) ? "ul" : "ol";

			list = list.replace(/\n{2,}/g,"\n\n\n");;
			var result = _ProcessListItems(list);

			result = result.replace(/\s+$/,"");
			result = "<"+list_type+">" + result + "</"+list_type+">\n";
			return result;
		});
	} else {
		whole_list = /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
		text = text.replace(whole_list,function(wholeMatch,m1,m2,m3) {
			var runup = m1;
			var list = m2;

			var list_type = (m3.search(/[*+-]/g)>-1) ? "ul" : "ol";
			var list = list.replace(/\n{2,}/g,"\n\n\n");;
			var result = _ProcessListItems(list);
			result = runup + "<"+list_type+">\n" + result + "</"+list_type+">\n";
			return result;
		});
	}

	text = text.replace(/~0/,"");

	return text;
}

_ProcessListItems = function(list_str) {

	g_list_level++;

	list_str = list_str.replace(/\n{2,}$/,"\n");

	list_str += "~0";

	/*
		list_str = list_str.replace(/
			(\n)?							// leading line = $1
			(^[ \t]*)						// leading whitespace = $2
			([*+-]|\d+[.]) [ \t]+			// list marker = $3
			([^\r]+?						// list item text   = $4
			(\n{1,2}))
			(?= \n* (~0 | \2 ([*+-]|\d+[.]) [ \t]+))
		/gm, function(){...});
	*/
	list_str = list_str.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,
		function(wholeMatch,m1,m2,m3,m4){
			var item = m4;
			var leading_line = m1;
			var leading_space = m2;

			if (leading_line || (item.search(/\n{2,}/)>-1)) {
				item = _RunBlockGamut(_Outdent(item));
			}
			else {
				item = _DoLists(_Outdent(item));
				item = item.replace(/\n$/,""); // chomp(item)
				item = _RunSpanGamut(item);
			}

			return  "<li>" + item + "</li>\n";
		}
	);

	list_str = list_str.replace(/~0/g,"");

	g_list_level--;
	return list_str;
}


var _DoCodeBlocks = function(text) {

	/*
		text = text.replace(text,
			/(?:\n\n|^)
			(								// $1 = the code block -- one or more lines, starting with a space/tab
				(?:
					(?:[ ]{4}|\t)			// Lines must start with a tab or a tab-width of spaces - attacklab: g_tab_width
					.*\n+
				)+
			)
			(\n*[ ]{0,3}[^ \t\n]|(?=~0))	// attacklab: g_tab_width
		/g,function(){...});
	*/

	text += "~0";

	text = text.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,
		function(wholeMatch,m1,m2) {
			var codeblock = m1;
			var nextChar = m2;

			codeblock = _EncodeCode( _Outdent(codeblock));
			codeblock = _Detab(codeblock);
			codeblock = codeblock.replace(/^\n+/g,""); // trim leading newlines
			codeblock = codeblock.replace(/\n+$/g,""); // trim trailing whitespace

			codeblock = "<pre><code>" + codeblock + "\n</code></pre>";

			return hashBlock(codeblock) + nextChar;
		}
	);

	text = text.replace(/~0/,"");

	return text;
}

var hashBlock = function(text) {
	text = text.replace(/(^\n+|\n+$)/g,"");
	return "\n\n~K" + (g_html_blocks.push(text)-1) + "K\n\n";
}


var _DoCodeSpans = function(text) {

	/*
		text = text.replace(/
			(^|[^\\])					// Character before opening ` can't be a backslash
			(`+)						// $2 = Opening run of `
			(							// $3 = The code block
				[^\r]*?
				[^`]					// attacklab: work around lack of lookbehind
			)
			\2							// Matching closer
			(?!`)
		/gm, function(){...});
	*/

	text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
		function(wholeMatch,m1,m2,m3,m4) {
			var c = m3;
			c = c.replace(/^([ \t]*)/g,"");	// leading whitespace
			c = c.replace(/[ \t]*$/g,"");	// trailing whitespace
			c = _EncodeCode(c);
			return m1+"<code>"+c+"</code>";
		});

	return text;
}


var _EncodeCode = function(text) {
	text = text.replace(/&/g,"&amp;");

	text = text.replace(/</g,"&lt;");
	text = text.replace(/>/g,"&gt;");

	text = escapeCharacters(text,"\*_{}[]\\",false);





	return text;
}


var _DoItalicsAndBold = function(text) {

	text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,
		"<strong>$2</strong>");

	text = text.replace(/(\w)_(\w)/g, "$1~E95E$2") // ** GFM **  "~E95E" == escaped "_"
	text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,
		"<em>$2</em>");

	return text;
}


var _DoBlockQuotes = function(text) {

	/*
		text = text.replace(/
		(								// Wrap whole match in $1
			(
				^[ \t]*>[ \t]?			// '>' at the start of a line
				.+\n					// rest of the first line
				(.+\n)*					// subsequent consecutive lines
				\n*						// blanks
			)+
		)
		/gm, function(){...});
	*/

	text = text.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,
		function(wholeMatch,m1) {
			var bq = m1;


			bq = bq.replace(/^[ \t]*>[ \t]?/gm,"~0");	// trim one level of quoting

			bq = bq.replace(/~0/g,"");

			bq = bq.replace(/^[ \t]+$/gm,"");		// trim whitespace-only lines
			bq = _RunBlockGamut(bq);				// recurse

			bq = bq.replace(/(^|\n)/g,"$1  ");
			bq = bq.replace(
					/(\s*<pre>[^\r]+?<\/pre>)/gm,
				function(wholeMatch,m1) {
					var pre = m1;
					pre = pre.replace(/^  /mg,"~0");
					pre = pre.replace(/~0/g,"");
					return pre;
				});

			return hashBlock("<blockquote>\n" + bq + "\n</blockquote>");
		});
	return text;
}


var _FormParagraphs = function(text) {

	text = text.replace(/^\n+/g,"");
	text = text.replace(/\n+$/g,"");

	var grafs = text.split(/\n{2,}/g);
	var grafsOut = new Array();

	var end = grafs.length;
	for (var i=0; i<end; i++) {
		var str = grafs[i];

		if (str.search(/~K(\d+)K/g) >= 0) {
			grafsOut.push(str);
		}
		else if (str.search(/\S/) >= 0) {
			str = _RunSpanGamut(str);
			str = str.replace(/\n/g,"<br />");  // ** GFM **
			str = str.replace(/^([ \t]*)/g,"<p>");
			str += "</p>"
			grafsOut.push(str);
		}

	}

	end = grafsOut.length;
	for (var i=0; i<end; i++) {
		while (grafsOut[i].search(/~K(\d+)K/) >= 0) {
			var blockText = g_html_blocks[RegExp.$1];
			blockText = blockText.replace(/\$/g,"$$$$"); // Escape any dollar signs
			grafsOut[i] = grafsOut[i].replace(/~K\d+K/,blockText);
		}
	}

	return grafsOut.join("\n\n");
}


var _EncodeAmpsAndAngles = function(text) {

	text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;");

	text = text.replace(/<(?![a-z\/?\$!])/gi,"&lt;");

	return text;
}


var _EncodeBackslashEscapes = function(text) {


	text = text.replace(/\\(\\)/g,escapeCharacters_callback);
	text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g,escapeCharacters_callback);
	return text;
}


var _DoAutoLinks = function(text) {

	text = text.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi,"<a href=\"$1\">$1</a>");


	/*
		text = text.replace(/
			<
			(?:mailto:)?
			(
				[-.\w]+
				\@
				[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+
			)
			>
		/gi, _DoAutoLinks_callback());
	*/
	text = text.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,
		function(wholeMatch,m1) {
			return _EncodeEmailAddress( _UnescapeSpecialChars(m1) );
		}
	);

	return text;
}


var _EncodeEmailAddress = function(addr) {

	function char2hex(ch) {
		var hexDigits = '0123456789ABCDEF';
		var dec = ch.charCodeAt(0);
		return(hexDigits.charAt(dec>>4) + hexDigits.charAt(dec&15));
	}

	var encode = [
		function(ch){return "&#"+ch.charCodeAt(0)+";";},
		function(ch){return "&#x"+char2hex(ch)+";";},
		function(ch){return ch;}
	];

	addr = "mailto:" + addr;

	addr = addr.replace(/./g, function(ch) {
		if (ch == "@") {
			ch = encode[Math.floor(Math.random()*2)](ch);
		} else if (ch !=":") {
			var r = Math.random();
			ch =  (
					r > .9  ?	encode[2](ch)   :
					r > .45 ?	encode[1](ch)   :
								encode[0](ch)
				);
		}
		return ch;
	});

	addr = "<a href=\"" + addr + "\">" + addr + "</a>";
	addr = addr.replace(/">.+:/g,"\">"); // strip the mailto: from the visible part

	return addr;
}


var _UnescapeSpecialChars = function(text) {
	text = text.replace(/~E(\d+)E/g,
		function(wholeMatch,m1) {
			var charCodeToReplace = parseInt(m1);
			return String.fromCharCode(charCodeToReplace);
		}
	);
	return text;
}


var _Outdent = function(text) {


	text = text.replace(/^(\t|[ ]{1,4})/gm,"~0"); // attacklab: g_tab_width

	text = text.replace(/~0/g,"")

	return text;
}

var _Detab = function(text) {

	text = text.replace(/\t(?=\t)/g,"    "); // attacklab: g_tab_width

	text = text.replace(/\t/g,"~A~B");

	text = text.replace(/~B(.+?)~A/g,
		function(wholeMatch,m1,m2) {
			var leadingText = m1;
			var numSpaces = 4 - leadingText.length % 4;  // attacklab: g_tab_width

			for (var i=0; i<numSpaces; i++) leadingText+=" ";

			return leadingText;
		}
	);

	text = text.replace(/~A/g,"    ");  // attacklab: g_tab_width
	text = text.replace(/~B/g,"");

	return text;
}




var escapeCharacters = function(text, charsToEscape, afterBackslash) {
	var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g,"\\$1") + "])";

	if (afterBackslash) {
		regexString = "\\\\" + regexString;
	}

	var regex = new RegExp(regexString,"g");
	text = text.replace(regex,escapeCharacters_callback);

	return text;
}


var escapeCharacters_callback = function(wholeMatch,m1) {
	var charCodeToEscape = m1.charCodeAt(0);
	return "~E"+charCodeToEscape+"E";
}

} // end of Showdown.converter
/*!
 * Modernizr v2.0.6
 * http://www.modernizr.com
 *
 * Copyright (c) 2009-2011 Faruk Ates, Paul Irish, Alex Sexton
 * Dual-licensed under the BSD or MIT licenses: www.modernizr.com/license/
 */

/*
 * Modernizr tests which native CSS3 and HTML5 features are available in
 * the current UA and makes the results available to you in two ways:
 * as properties on a global Modernizr object, and as classes on the
 * <html> element. This information allows you to progressively enhance
 * your pages with a granular level of control over the experience.
 *
 * Modernizr has an optional (not included) conditional resource loader
 * called Modernizr.load(), based on Yepnope.js (yepnopejs.com).
 * To get a build that includes Modernizr.load(), as well as choosing
 * which tests to include, go to www.modernizr.com/download/
 *
 * Authors        Faruk Ates, Paul Irish, Alex Sexton,
 * Contributors   Ryan Seddon, Ben Alman
 */

window.Modernizr = (function( window, document, undefined ) {

    var version = '2.0.6',

    Modernizr = {},

    enableClasses = true,

    docElement = document.documentElement,
    docHead = document.head || document.getElementsByTagName('head')[0],

    /**
     * Create our "modernizr" element that we do most feature tests on.
     */
    mod = 'modernizr',
    modElem = document.createElement(mod),
    mStyle = modElem.style,

    /**
     * Create the input element for various Web Forms feature tests.
     */
    inputElem = document.createElement('input'),

    smile = ':)',

    toString = {}.toString,

    prefixes = ' -webkit- -moz- -o- -ms- -khtml- '.split(' '),



    domPrefixes = 'Webkit Moz O ms Khtml'.split(' '),

    ns = {'svg': 'http://www.w3.org/2000/svg'},

    tests = {},
    inputs = {},
    attrs = {},

    classes = [],

    featureName, // used in testing loop


    injectElementWithStyles = function( rule, callback, nodes, testnames ) {

      var style, ret, node,
          div = document.createElement('div');

      if ( parseInt(nodes, 10) ) {
          while ( nodes-- ) {
              node = document.createElement('div');
              node.id = testnames ? testnames[nodes] : mod + (nodes + 1);
              div.appendChild(node);
          }
      }

      style = ['&shy;', '<style>', rule, '</style>'].join('');
      div.id = mod;
      div.innerHTML += style;
      docElement.appendChild(div);

      ret = callback(div, rule);
      div.parentNode.removeChild(div);

      return !!ret;

    },


    testMediaQuery = function( mq ) {

      if ( window.matchMedia ) {
        return matchMedia(mq).matches;
      }

      var bool;

      injectElementWithStyles('@media ' + mq + ' { #' + mod + ' { position: absolute; } }', function( node ) {
        bool = (window.getComputedStyle ?
                  getComputedStyle(node, null) :
                  node.currentStyle)['position'] == 'absolute';
      });

      return bool;

     },


    /**
      * isEventSupported determines if a given element supports the given event
      * function from http://yura.thinkweb2.com/isEventSupported/
      */
    isEventSupported = (function() {

      var TAGNAMES = {
        'select': 'input', 'change': 'input',
        'submit': 'form', 'reset': 'form',
        'error': 'img', 'load': 'img', 'abort': 'img'
      };

      function isEventSupported( eventName, element ) {

        element = element || document.createElement(TAGNAMES[eventName] || 'div');
        eventName = 'on' + eventName;

        var isSupported = eventName in element;

        if ( !isSupported ) {
          if ( !element.setAttribute ) {
            element = document.createElement('div');
          }
          if ( element.setAttribute && element.removeAttribute ) {
            element.setAttribute(eventName, '');
            isSupported = is(element[eventName], 'function');

            if ( !is(element[eventName], undefined) ) {
              element[eventName] = undefined;
            }
            element.removeAttribute(eventName);
          }
        }

        element = null;
        return isSupported;
      }
      return isEventSupported;
    })();

    var _hasOwnProperty = ({}).hasOwnProperty, hasOwnProperty;
    if ( !is(_hasOwnProperty, undefined) && !is(_hasOwnProperty.call, undefined) ) {
      hasOwnProperty = function (object, property) {
        return _hasOwnProperty.call(object, property);
      };
    }
    else {
      hasOwnProperty = function (object, property) { /* yes, this can give false positives/negatives, but most of the time we don't care about those */
        return ((property in object) && is(object.constructor.prototype[property], undefined));
      };
    }

    /**
     * setCss applies given styles to the Modernizr DOM node.
     */
    function setCss( str ) {
        mStyle.cssText = str;
    }

    /**
     * setCssAll extrapolates all vendor-specific css strings.
     */
    function setCssAll( str1, str2 ) {
        return setCss(prefixes.join(str1 + ';') + ( str2 || '' ));
    }

    /**
     * is returns a boolean for if typeof obj is exactly type.
     */
    function is( obj, type ) {
        return typeof obj === type;
    }

    /**
     * contains returns a boolean for if substr is found within str.
     */
    function contains( str, substr ) {
        return !!~('' + str).indexOf(substr);
    }

    /**
     * testProps is a generic CSS / DOM property test; if a browser supports
     *   a certain property, it won't return undefined for it.
     *   A supported CSS property returns empty string when its not yet set.
     */
    function testProps( props, prefixed ) {
        for ( var i in props ) {
            if ( mStyle[ props[i] ] !== undefined ) {
                return prefixed == 'pfx' ? props[i] : true;
            }
        }
        return false;
    }

    /**
     * testPropsAll tests a list of DOM properties we want to check against.
     *   We specify literally ALL possible (known and/or likely) properties on
     *   the element including the non-vendor prefixed one, for forward-
     *   compatibility.
     */
    function testPropsAll( prop, prefixed ) {

        var ucProp  = prop.charAt(0).toUpperCase() + prop.substr(1),
            props   = (prop + ' ' + domPrefixes.join(ucProp + ' ') + ucProp).split(' ');

        return testProps(props, prefixed);
    }

    /**
     * testBundle tests a list of CSS features that require element and style injection.
     *   By bundling them together we can reduce the need to touch the DOM multiple times.
     */
    /*>>testBundle*/
    var testBundle = (function( styles, tests ) {
        var style = styles.join(''),
            len = tests.length;

        injectElementWithStyles(style, function( node, rule ) {
            var style = document.styleSheets[document.styleSheets.length - 1],
                cssText = style.cssRules && style.cssRules[0] ? style.cssRules[0].cssText : style.cssText || "",
                children = node.childNodes, hash = {};

            while ( len-- ) {
                hash[children[len].id] = children[len];
            }

             /*>>touch*/           Modernizr['touch'] = ('ontouchstart' in window) || (hash['touch'] && hash['touch'].offsetTop) === 9; /*>>touch*/
            /*>>csstransforms3d*/ Modernizr['csstransforms3d'] = (hash['csstransforms3d'] && hash['csstransforms3d'].offsetLeft) === 9;          /*>>csstransforms3d*/
            /*>>generatedcontent*/Modernizr['generatedcontent'] = (hash['generatedcontent'] && hash['generatedcontent'].offsetHeight) >= 1;       /*>>generatedcontent*/
            /*>>fontface*/        Modernizr['fontface'] = /src/i.test(cssText) &&
                                                                  cssText.indexOf(rule.split(' ')[0]) === 0;        /*>>fontface*/
        }, len, tests);

    })([
        /*>>fontface*/        '@font-face {font-family:"font";src:url("https://")}'         /*>>fontface*/

        /*>>touch*/           ,['@media (',prefixes.join('touch-enabled),('),mod,')',
                                '{#touch{top:9px;position:absolute}}'].join('')           /*>>touch*/

        /*>>csstransforms3d*/ ,['@media (',prefixes.join('transform-3d),('),mod,')',
                                '{#csstransforms3d{left:9px;position:absolute}}'].join('')/*>>csstransforms3d*/

        /*>>generatedcontent*/,['#generatedcontent:after{content:"',smile,'";visibility:hidden}'].join('')  /*>>generatedcontent*/
    ],
      [
        /*>>fontface*/        'fontface'          /*>>fontface*/
        /*>>touch*/           ,'touch'            /*>>touch*/
        /*>>csstransforms3d*/ ,'csstransforms3d'  /*>>csstransforms3d*/
        /*>>generatedcontent*/,'generatedcontent' /*>>generatedcontent*/

    ]);/*>>testBundle*/


    /**
     * Tests
     * -----
     */

    tests['flexbox'] = function() {
        /**
         * setPrefixedValueCSS sets the property of a specified element
         * adding vendor prefixes to the VALUE of the property.
         * @param {Element} element
         * @param {string} property The property name. This will not be prefixed.
         * @param {string} value The value of the property. This WILL be prefixed.
         * @param {string=} extra Additional CSS to append unmodified to the end of
         * the CSS string.
         */
        function setPrefixedValueCSS( element, property, value, extra ) {
            property += ':';
            element.style.cssText = (property + prefixes.join(value + ';' + property)).slice(0, -property.length) + (extra || '');
        }

        /**
         * setPrefixedPropertyCSS sets the property of a specified element
         * adding vendor prefixes to the NAME of the property.
         * @param {Element} element
         * @param {string} property The property name. This WILL be prefixed.
         * @param {string} value The value of the property. This will not be prefixed.
         * @param {string=} extra Additional CSS to append unmodified to the end of
         * the CSS string.
         */
        function setPrefixedPropertyCSS( element, property, value, extra ) {
            element.style.cssText = prefixes.join(property + ':' + value + ';') + (extra || '');
        }

        var c = document.createElement('div'),
            elem = document.createElement('div');

        setPrefixedValueCSS(c, 'display', 'box', 'width:42px;padding:0;');
        setPrefixedPropertyCSS(elem, 'box-flex', '1', 'width:10px;');

        c.appendChild(elem);
        docElement.appendChild(c);

        var ret = elem.offsetWidth === 42;

        c.removeChild(elem);
        docElement.removeChild(c);

        return ret;
    };


    tests['canvas'] = function() {
        var elem = document.createElement('canvas');
        return !!(elem.getContext && elem.getContext('2d'));
    };

    tests['canvastext'] = function() {
        return !!(Modernizr['canvas'] && is(document.createElement('canvas').getContext('2d').fillText, 'function'));
    };



    tests['webgl'] = function() {
        return !!window.WebGLRenderingContext;
    };

    /*
     * The Modernizr.touch test only indicates if the browser supports
     *    touch events, which does not necessarily reflect a touchscreen
     *    device, as evidenced by tablets running Windows 7 or, alas,
     *    the Palm Pre / WebOS (touch) phones.
     *
     * Additionally, Chrome (desktop) used to lie about its support on this,
     *    but that has since been rectified: http://crbug.com/36415
     *
     * We also test for Firefox 4 Multitouch Support.
     *
     * For more info, see: http://modernizr.github.com/Modernizr/touch.html
     */

    tests['touch'] = function() {
        return Modernizr['touch'];
    };

    /**
     * geolocation tests for the new Geolocation API specification.
     *   This test is a standards compliant-only test; for more complete
     *   testing, including a Google Gears fallback, please see:
     *   http://code.google.com/p/geo-location-javascript/
     * or view a fallback solution using google's geo API:
     *   http://gist.github.com/366184
     */
    tests['geolocation'] = function() {
        return !!navigator.geolocation;
    };

    tests['postmessage'] = function() {
      return !!window.postMessage;
    };




    tests['websqldatabase'] = function() {
      var result = !!window.openDatabase;
      /*  if (result){
            try {
              result = !!openDatabase( mod + "testdb", "1.0", mod + "testdb", 2e4);
            } catch(e) {
            }
          }  */
      return result;
    };

    tests['indexedDB'] = function() {
      for ( var i = -1, len = domPrefixes.length; ++i < len; ){
        if ( window[domPrefixes[i].toLowerCase() + 'IndexedDB'] ){
          return true;
        }
      }
      return !!window.indexedDB;
    };

    tests['hashchange'] = function() {
      return isEventSupported('hashchange', window) && (document.documentMode === undefined || document.documentMode > 7);
    };

    tests['history'] = function() {
      return !!(window.history && history.pushState);
    };

    tests['draganddrop'] = function() {
        return isEventSupported('dragstart') && isEventSupported('drop');
    };

    tests['websockets'] = function() {
        for ( var i = -1, len = domPrefixes.length; ++i < len; ){
          if ( window[domPrefixes[i] + 'WebSocket'] ){
            return true;
          }
        }
        return 'WebSocket' in window;
    };


    tests['rgba'] = function() {

        setCss('background-color:rgba(150,255,150,.5)');

        return contains(mStyle.backgroundColor, 'rgba');
    };

    tests['hsla'] = function() {

        setCss('background-color:hsla(120,40%,100%,.5)');

        return contains(mStyle.backgroundColor, 'rgba') || contains(mStyle.backgroundColor, 'hsla');
    };

    tests['multiplebgs'] = function() {

        setCss('background:url(https://),url(https://),red url(https://)');


        return /(url\s*\(.*?){3}/.test(mStyle.background);
    };





    tests['backgroundsize'] = function() {
        return testPropsAll('backgroundSize');
    };

    tests['borderimage'] = function() {
        return testPropsAll('borderImage');
    };



    tests['borderradius'] = function() {
        return testPropsAll('borderRadius');
    };

    tests['boxshadow'] = function() {
        return testPropsAll('boxShadow');
    };

    tests['textshadow'] = function() {
        return document.createElement('div').style.textShadow === '';
    };


    tests['opacity'] = function() {

        setCssAll('opacity:.55');

        return /^0.55$/.test(mStyle.opacity);
    };


    tests['cssanimations'] = function() {
        return testPropsAll('animationName');
    };


    tests['csscolumns'] = function() {
        return testPropsAll('columnCount');
    };


    tests['cssgradients'] = function() {
        /**
         * For CSS Gradients syntax, please see:
         * http://webkit.org/blog/175/introducing-css-gradients/
         * https://developer.mozilla.org/en/CSS/-moz-linear-gradient
         * https://developer.mozilla.org/en/CSS/-moz-radial-gradient
         * http://dev.w3.org/csswg/css3-images/#gradients-
         */

        var str1 = 'background-image:',
            str2 = 'gradient(linear,left top,right bottom,from(#9f9),to(white));',
            str3 = 'linear-gradient(left top,#9f9, white);';

        setCss(
            (str1 + prefixes.join(str2 + str1) + prefixes.join(str3 + str1)).slice(0, -str1.length)
        );

        return contains(mStyle.backgroundImage, 'gradient');
    };


    tests['cssreflections'] = function() {
        return testPropsAll('boxReflect');
    };


    tests['csstransforms'] = function() {
        return !!testProps(['transformProperty', 'WebkitTransform', 'MozTransform', 'OTransform', 'msTransform']);
    };


    tests['csstransforms3d'] = function() {

        var ret = !!testProps(['perspectiveProperty', 'WebkitPerspective', 'MozPerspective', 'OPerspective', 'msPerspective']);

        if ( ret && 'webkitPerspective' in docElement.style ) {

          ret = Modernizr['csstransforms3d'];
        }
        return ret;
    };


    tests['csstransitions'] = function() {
        return testPropsAll('transitionProperty');
    };


    /*>>fontface*/
    tests['fontface'] = function() {
        return Modernizr['fontface'];
    };
    /*>>fontface*/

    tests['generatedcontent'] = function() {
        return Modernizr['generatedcontent'];
    };





    tests['video'] = function() {
        var elem = document.createElement('video'),
            bool = false;

        try {
            if ( bool = !!elem.canPlayType ) {
                bool      = new Boolean(bool);
                bool.ogg  = elem.canPlayType('video/ogg; codecs="theora"');

                var h264 = 'video/mp4; codecs="avc1.42E01E';
                bool.h264 = elem.canPlayType(h264 + '"') || elem.canPlayType(h264 + ', mp4a.40.2"');

                bool.webm = elem.canPlayType('video/webm; codecs="vp8, vorbis"');
            }

        } catch(e) { }

        return bool;
    };

    tests['audio'] = function() {
        var elem = document.createElement('audio'),
            bool = false;

        try {
            if ( bool = !!elem.canPlayType ) {
                bool      = new Boolean(bool);
                bool.ogg  = elem.canPlayType('audio/ogg; codecs="vorbis"');
                bool.mp3  = elem.canPlayType('audio/mpeg;');

                bool.wav  = elem.canPlayType('audio/wav; codecs="1"');
                bool.m4a  = elem.canPlayType('audio/x-m4a;') || elem.canPlayType('audio/aac;');
            }
        } catch(e) { }

        return bool;
    };








    tests['localstorage'] = function() {
        try {
            return !!localStorage.getItem;
        } catch(e) {
            return false;
        }
    };

    tests['sessionstorage'] = function() {
        try {
            return !!sessionStorage.getItem;
        } catch(e){
            return false;
        }
    };


    tests['webworkers'] = function() {
        return !!window.Worker;
    };


    tests['applicationcache'] = function() {
        return !!window.applicationCache;
    };


    tests['svg'] = function() {
        return !!document.createElementNS && !!document.createElementNS(ns.svg, 'svg').createSVGRect;
    };

    tests['inlinesvg'] = function() {
      var div = document.createElement('div');
      div.innerHTML = '<svg/>';
      return (div.firstChild && div.firstChild.namespaceURI) == ns.svg;
    };

    tests['smil'] = function() {
        return !!document.createElementNS && /SVG/.test(toString.call(document.createElementNS(ns.svg, 'animate')));
    };

    tests['svgclippaths'] = function() {
        return !!document.createElementNS && /SVG/.test(toString.call(document.createElementNS(ns.svg, 'clipPath')));
    };

    function webforms() {

        Modernizr['input'] = (function( props ) {
            for ( var i = 0, len = props.length; i < len; i++ ) {
                attrs[ props[i] ] = !!(props[i] in inputElem);
            }
            return attrs;
        })('autocomplete autofocus list placeholder max min multiple pattern required step'.split(' '));


        Modernizr['inputtypes'] = (function(props) {

            for ( var i = 0, bool, inputElemType, defaultView, len = props.length; i < len; i++ ) {

                inputElem.setAttribute('type', inputElemType = props[i]);
                bool = inputElem.type !== 'text';

                if ( bool ) {

                    inputElem.value         = smile;
                    inputElem.style.cssText = 'position:absolute;visibility:hidden;';

                    if ( /^range$/.test(inputElemType) && inputElem.style.WebkitAppearance !== undefined ) {

                      docElement.appendChild(inputElem);
                      defaultView = document.defaultView;

                      bool =  defaultView.getComputedStyle &&
                              defaultView.getComputedStyle(inputElem, null).WebkitAppearance !== 'textfield' &&
                              (inputElem.offsetHeight !== 0);

                      docElement.removeChild(inputElem);

                    } else if ( /^(search|tel)$/.test(inputElemType) ){


                    } else if ( /^(url|email)$/.test(inputElemType) ) {
                      bool = inputElem.checkValidity && inputElem.checkValidity() === false;

                    } else if ( /^color$/.test(inputElemType) ) {
                        docElement.appendChild(inputElem);
                        docElement.offsetWidth;
                        bool = inputElem.value != smile;
                        docElement.removeChild(inputElem);

                    } else {
                      bool = inputElem.value != smile;
                    }
                }

                inputs[ props[i] ] = !!bool;
            }
            return inputs;
        })('search tel url email datetime date month week time datetime-local number range color'.split(' '));
    }





    for ( var feature in tests ) {
        if ( hasOwnProperty(tests, feature) ) {
            featureName  = feature.toLowerCase();
            Modernizr[featureName] = tests[feature]();

            classes.push((Modernizr[featureName] ? '' : 'no-') + featureName);
        }
    }

    Modernizr.input || webforms();


    /**
     * addTest allows the user to define their own feature tests
     * the result will be added onto the Modernizr object,
     * as well as an appropriate className set on the html element
     *
     * @param feature - String naming the feature
     * @param test - Function returning true if feature is supported, false if not
     */
     Modernizr.addTest = function ( feature, test ) {
       if ( typeof feature == "object" ) {
         for ( var key in feature ) {
           if ( hasOwnProperty( feature, key ) ) {
             Modernizr.addTest( key, feature[ key ] );
           }
         }
       } else {

         feature = feature.toLowerCase();

         if ( Modernizr[feature] !== undefined ) {
           return;
         }

         test = typeof test == "boolean" ? test : !!test();

         if ( enableClasses ) docElement.className += ' ' + (test ? '' : 'no-') + feature;
         Modernizr[feature] = test;

       }

       return Modernizr; // allow chaining.
     };


    setCss('');
    modElem = inputElem = null;

    if ( window.attachEvent && (function(){ var elem = document.createElement('div');
                                            elem.innerHTML = '<elem></elem>';
                                            return elem.childNodes.length !== 1; })() ) {

        (function(win, doc) {
          win.iepp = win.iepp || {};
          var iepp = win.iepp,
            elems = iepp.html5elements || 'abbr|article|aside|audio|canvas|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video',
            elemsArr = elems.split('|'),
            elemsArrLen = elemsArr.length,
            elemRegExp = new RegExp('(^|\\s)('+elems+')', 'gi'),
            tagRegExp = new RegExp('<(\/*)('+elems+')', 'gi'),
            filterReg = /^\s*[\{\}]\s*$/,
            ruleRegExp = new RegExp('(^|[^\\n]*?\\s)('+elems+')([^\\n]*)({[\\n\\w\\W]*?})', 'gi'),
            docFrag = doc.createDocumentFragment(),
            html = doc.documentElement,
            head = html.firstChild,
            bodyElem = doc.createElement('body'),
            styleElem = doc.createElement('style'),
            printMedias = /print|all/,
            body;
          function shim(doc) {
            var a = -1;
            while (++a < elemsArrLen)
              doc.createElement(elemsArr[a]);
          }

          iepp.getCSS = function(styleSheetList, mediaType) {
            if(styleSheetList+'' === undefined){return '';}
            var a = -1,
              len = styleSheetList.length,
              styleSheet,
              cssTextArr = [];
            while (++a < len) {
              styleSheet = styleSheetList[a];
              if(styleSheet.disabled){continue;}
              mediaType = styleSheet.media || mediaType;
              if (printMedias.test(mediaType)) cssTextArr.push(iepp.getCSS(styleSheet.imports, mediaType), styleSheet.cssText);
              mediaType = 'all';
            }
            return cssTextArr.join('');
          };

          iepp.parseCSS = function(cssText) {
            var cssTextArr = [],
              rule;
            while ((rule = ruleRegExp.exec(cssText)) != null){
              cssTextArr.push(( (filterReg.exec(rule[1]) ? '\n' : rule[1]) +rule[2]+rule[3]).replace(elemRegExp, '$1.iepp_$2')+rule[4]);
            }
            return cssTextArr.join('\n');
          };

          iepp.writeHTML = function() {
            var a = -1;
            body = body || doc.body;
            while (++a < elemsArrLen) {
              var nodeList = doc.getElementsByTagName(elemsArr[a]),
                nodeListLen = nodeList.length,
                b = -1;
              while (++b < nodeListLen)
                if (nodeList[b].className.indexOf('iepp_') < 0)
                  nodeList[b].className += ' iepp_'+elemsArr[a];
            }
            docFrag.appendChild(body);
            html.appendChild(bodyElem);
            bodyElem.className = body.className;
            bodyElem.id = body.id;
            bodyElem.innerHTML = body.innerHTML.replace(tagRegExp, '<$1font');
          };


          iepp._beforePrint = function() {
            styleElem.styleSheet.cssText = iepp.parseCSS(iepp.getCSS(doc.styleSheets, 'all'));
            iepp.writeHTML();
          };

          iepp.restoreHTML = function(){
            bodyElem.innerHTML = '';
            html.removeChild(bodyElem);
            html.appendChild(body);
          };

          iepp._afterPrint = function(){
            iepp.restoreHTML();
            styleElem.styleSheet.cssText = '';
          };



          shim(doc);
          shim(docFrag);

          if(iepp.disablePP){return;}

          head.insertBefore(styleElem, head.firstChild);
          styleElem.media = 'print';
          styleElem.className = 'iepp-printshim';
          win.attachEvent(
            'onbeforeprint',
            iepp._beforePrint
          );
          win.attachEvent(
            'onafterprint',
            iepp._afterPrint
          );
        })(window, document);
    }

    Modernizr._version      = version;

    Modernizr._prefixes     = prefixes;
    Modernizr._domPrefixes  = domPrefixes;

    Modernizr.mq            = testMediaQuery;

    Modernizr.hasEvent      = isEventSupported;

    Modernizr.testProp      = function(prop){
        return testProps([prop]);
    };

    Modernizr.testAllProps  = testPropsAll;



    Modernizr.testStyles    = injectElementWithStyles;





    Modernizr.prefixed      = function(prop){
      return testPropsAll(prop, 'pfx');
    };



    docElement.className = docElement.className.replace(/\bno-js\b/, '')

                            + (enableClasses ? ' js ' + classes.join(' ') : '');

    return Modernizr;

})(this, this.document);

Function.prototype.throttle = function(t) {
  var timeout, fn = this, tick = function() {
    var scope = this, args = arguments
    fn.apply(scope, args)
    timeout = null
  }
  return function() {
    var timeout, fn = this
    if (!timeout) timeout = setTimeout(tick, t)
  }
}

Function.prototype.debounce = function(t) {
  var timeout, fn = this
  return function() {
    var scope = this, args = arguments
    timeout && clearTimeout(timeout)
    timeout = setTimeout(function() { fn.apply(scope, args) }, t)
  }
}

Element.addMethods({
  forceShow: function(element, display) {
    return $(element).setStyle({ display: (display || 'block') })
  },
  swapVisibility: function(element, other) {
    $(other).forceShow('inline-block')
    return $(element).hide()
  },
  insertOrUpdate: function(element, selector, content) {
    element = $(element)
    var target = element.down(selector)
    if (!target) {
      var classnames = selector.match(/(?:\.\w+)+/)
      if (classnames) classnames = classnames[0].gsub('.', ' ').strip()
      var id = selector.match(/#(\w+)/)
      if (id) id = id[1]
      var tagName = (classnames || id) ? selector.match(/\w+/)[0] : selector
      target = new Element(tagName, { 'class': classnames, id: id })
      element.insert(target)
    }
    target.update(content)
    return target
  }
})

Event.onReady = function(fn) {
  if (document.body) fn()
  else document.on('dom:loaded', fn)
}

Event.addBehavior = function(hash) {
  var behaviors = $H(hash)
  behaviors.each(function(pair) {
    var selector = pair.key.split(':'), fn = pair.value
    document.on(selector[1], selector[0], function(e, el) { fn.call(el, e) })
  })
}
Event.addBehavior.reload = Prototype.emptyFunction

function hideBySelector(selector) {
  insertCss(selector + ' {display:none}')
}

function insertCss(css) {
  var head = document.getElementsByTagName('head')[0],
      style = document.createElement('style')

  style.setAttribute("type", "text/css")

  if (style.styleSheet) { // IE
    style.styleSheet.cssText = css;
  } else { // w3c
    var cssText = document.createTextNode(css);
    style.appendChild(cssText);
  }
  head.appendChild(style)
}

replace_ids = function(s){
  var new_id = new Date().getTime();
  return s.replace(/NEW_RECORD/g, new_id);
}

Event.addBehavior({
  ".add_nested_item:click": function(e){
    link = $(this);
    template = eval(link.href.replace(/.*#/, ''))
    $(link.rel).insert({ bottom: replace_ids(template) });
    Event.addBehavior.reload();
  },
  ".remove_nested_item:click": function(e){
    link = $(this);
    target = link.href.replace(/.*#/, '.')
    link.up(target).hide();
    if(hidden_input = link.previous("input[type=hidden]")) hidden_input.value = '1'
  }
});

var Actions = {
  setActions: function(element, visible) {
    var actions = element.up('.task_list_container, .comment').down('.actions_menu');
    if (actions == null)
      return;
    if (visible)
      actions.show();
    else
      actions.hide();
  },

  setLoading: function(element, loading) {
    var actions = element.up('.task_list_container, .comment').down('.actions_menu');
    if (actions == null)
      return;
    if (loading)
    {
      actions.addClassName('loading');
      actions.down('span.loading').show();
      actions.down('span.actiondate').hide();
    }
    else
    {
      actions.removeClassName('loading');
      actions.down('span.loading').hide();
      actions.down('span.actiondate').show();
    }
  }
};

document.on('mouseover', '.comment .actions_menu', function(e, actions_menu) {
  var comment = actions_menu.up('.comment')

  if(comment.readAttribute('data-user') == my_user.id) {
    actions_menu.down('.edit').forceShow()
  }

  var projects_i_admin = $H(my_projects).select( function(e){ return(e[1].role == 3) } ).collect( function(e) { return e[0] } )
  if(projects_i_admin.include(comment.readAttribute('data-project'))) {
    actions_menu.down('.edit').forceShow()
    actions_menu.down('.delete').forceShow()
  }

  var now = new Date()
  var timestamp = comment.readAttribute('data-editable-before'),
      editableBefore = new Date(parseInt(timestamp))
  if (now >= editableBefore) {
    link = actions_menu.down('a.edit')
    if(link) {
      var message = link.readAttribute('data-uneditable-message')
      link.replace(new Element('span').update(message).addClassName('edit'))
    }
  }
})
Element.addMethods({
  resizeToText: function(area, force) {
    area = $(area)
    if (area.scrollHeight > area.clientHeight) {
      var wanted = area.getHeight() + (area.scrollHeight - area.clientHeight) + 15,
        available = document.viewport.getHeight() - area.viewportOffset().top - 60

      var possible = force ? wanted : Math.min(wanted, available)
      area.setStyle({ height: possible + 'px' })
    }
  }
})

var resizeLimited = Element.resizeToText.debounce(100)

document.on('keyup', 'textarea', function(e, area) {
  var doResize = function() { area.resizeToText(false) }

  if (e.keyCode == Event.KEY_RETURN) {
    Element.resizeToText.defer(area, false)
  } else {
    resizeLimited(area, false)
  }
})

document.on('facebox:opened', function() {
  $$('.facebox-content textarea').each(function(element){
    element.resizeToText(false)
  })
})

Badge = {
  checkAndGrantBadges: function() {
    Badge.grant("first_conversation", my_user.stats.conversations > 0);
    Badge.grant("first_task", my_user.stats.tasks > 0);
    Badge.grant("first_page", my_user.stats.pages > 0);
    Badge.grant("first_invite", my_user.stats.invites > 0);
    Badge.grant("first_project", my_user.stats.projects > 0);
  },
  has: function(name) {
    return my_user.badges.intersect([name]).length !== 0;
  },
  grant: function(name, condition) {
    if (this.has(name)) { return; }
    if (condition === false) { return; }
    my_user.badges.push(name);
    var save = new Ajax.Request("/account/badge/"+name+"/grant");
    if (!my_user.show_badges) { return; }
    $$('.overlay_badge').invoke('remove');
    $$('body')[0].insert({ bottom:
      Mustache.to_html(Templates.badges[name])
    });
    var badge = $$('.overlay_badge')[0];
    var pop = new Effect.MoveBottom(badge, {
      bottom: 300,
      transition: Effect.Transitions.spring,
      duration: 2
    });
    badge.highlight({ duration: 3 });
    this.showStars(badge);
    document.fire("badge:new_badge");
    document.fire("badge:"+name);
    return badge;
  },
  showStars: function(container) {
    container = container || $$('body')[0];
    for(var i=0; i<10; i++){
      var starting = {
        x: 16 + Math.floor(Math.random() * 470),
        y: -16
      };
      var star = new Element('img', {
        src: '/famfamfam/star.png',
        style: 'position: fixed; ' +
               'bottom: '+starting.y+'px; ' +
               'right: '+starting.x+'px; '
      });
      star.addClassName('badge_star');
      container.insert({ bottom: star });
      new Effect.Parallel([
        new Effect.MoveBottom(star, {
          sync: true,
          bottom: 250+Math.floor(Math.random() * 100)
        }),
        new Effect.Opacity(star, {
          sync: true, from: 1, to: 0
        })
      ], {
          duration: 2,
          transition: Effect.Transitions.linear,
          delay: Math.random()*2
      });
    }
  }
};

document.on("click", ".overlay_badge", function(e,el) {
  e.stop();
  el.fade();
});

document.on("dom:loaded", function() {
  Badge.checkAndGrantBadges();
});

document.on("stats:update", function() {
  Badge.checkAndGrantBadges();
});

Effect.MoveBottom = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) { throw(Effect._elementDoesNotExistError); }
    var options = Object.extend({
      bottom: 0
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.originalBottom = parseFloat(this.element.getStyle('bottom') || '0');
  },
  update: function(position) {
    this.element.setStyle({
      bottom: (this.options.bottom  * position + this.originalBottom).round() + 'px'
    });
  }
});
Banner = {
  deactivate_tabs: function() {
    $('tab_calendar').removeClassName("active");
    $('tab_gantt').removeClassName("active");
  },
  activate_tab: function(tab_id) {
    $(tab_id).addClassName("active");
  },
  hide_banner_items: function() {
    $$(".banner_item").invoke("hide");
  },
  show_banner: function(banner_id) {
    $(banner_id).show();
  }
}

document.on('click', '#show_calendar_link', function(e,el){
    e.stop();
    Banner.deactivate_tabs();
    Banner.hide_banner_items();
    Banner.show_banner("upcoming_events_banner");
    Banner.activate_tab("tab_calendar");
});

document.on('click', '#show_gantt_chart_link', function(e,el){
    e.stop();
    Banner.deactivate_tabs();
    Banner.hide_banner_items();
    Banner.show_banner("gantt_banner");
    Banner.activate_tab("tab_gantt");
});



if (!Control) var Control = { };

Control.Slider = Class.create({
  initialize: function(handle, track, options) {
    var slider = this;

    if (Object.isArray(handle)) {
      this.handles = handle.collect( function(e) { return $(e) });
    } else {
      this.handles = [$(handle)];
    }

    this.track   = $(track);
    this.options = options || { };

    this.axis      = this.options.axis || 'horizontal';
    this.increment = this.options.increment || 1;
    this.step      = parseInt(this.options.step || '1');
    this.range     = this.options.range || $R(0,1);

    this.value     = 0; // assure backwards compat
    this.values    = this.handles.map( function() { return 0 });
    this.spans     = this.options.spans ? this.options.spans.map(function(s){ return $(s) }) : false;
    this.options.startSpan = $(this.options.startSpan || null);
    this.options.endSpan   = $(this.options.endSpan || null);

    this.restricted = this.options.restricted || false;

    this.maximum   = this.options.maximum || this.range.end;
    this.minimum   = this.options.minimum || this.range.start;

    this.alignX = parseInt(this.options.alignX || '0');
    this.alignY = parseInt(this.options.alignY || '0');

    this.trackLength = this.maximumOffset() - this.minimumOffset();

    this.handleLength = this.isVertical() ?
      (this.handles[0].offsetHeight != 0 ?
        this.handles[0].offsetHeight : this.handles[0].style.height.replace(/px$/,"")) :
      (this.handles[0].offsetWidth != 0 ? this.handles[0].offsetWidth :
        this.handles[0].style.width.replace(/px$/,""));

    this.active   = false;
    this.dragging = false;
    this.disabled = false;

    if (this.options.disabled) this.setDisabled();

    this.allowedValues = this.options.values ? this.options.values.sortBy(Prototype.K) : false;
    if (this.allowedValues) {
      this.minimum = this.allowedValues.min();
      this.maximum = this.allowedValues.max();
    }

    this.eventMouseDown = this.startDrag.bindAsEventListener(this);
    this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
    this.eventMouseMove = this.update.bindAsEventListener(this);

    this.handles.each( function(h,i) {
      i = slider.handles.length-1-i;
      slider.setValue(parseFloat(
        (Object.isArray(slider.options.sliderValue) ?
          slider.options.sliderValue[i] : slider.options.sliderValue) ||
         slider.range.start), i);
      h.makePositioned().observe("mousedown", slider.eventMouseDown);
    });

    this.track.observe("mousedown", this.eventMouseDown);
    document.observe("mouseup", this.eventMouseUp);
    document.observe("mousemove", this.eventMouseMove);

    this.initialized = true;
  },
  dispose: function() {
    var slider = this;
    Event.stopObserving(this.track, "mousedown", this.eventMouseDown);
    Event.stopObserving(document, "mouseup", this.eventMouseUp);
    Event.stopObserving(document, "mousemove", this.eventMouseMove);
    this.handles.each( function(h) {
      Event.stopObserving(h, "mousedown", slider.eventMouseDown);
    });
  },
  setDisabled: function(){
    this.disabled = true;
  },
  setEnabled: function(){
    this.disabled = false;
  },
  getNearestValue: function(value){
    if (this.allowedValues){
      if (value >= this.allowedValues.max()) return(this.allowedValues.max());
      if (value <= this.allowedValues.min()) return(this.allowedValues.min());

      var offset = Math.abs(this.allowedValues[0] - value);
      var newValue = this.allowedValues[0];
      this.allowedValues.each( function(v) {
        var currentOffset = Math.abs(v - value);
        if (currentOffset <= offset){
          newValue = v;
          offset = currentOffset;
        }
      });
      return newValue;
    }
    if (value > this.range.end) return this.range.end;
    if (value < this.range.start) return this.range.start;
    return value;
  },
  setValue: function(sliderValue, handleIdx){
    if (!this.active) {
      this.activeHandleIdx = handleIdx || 0;
      this.activeHandle    = this.handles[this.activeHandleIdx];
      this.updateStyles();
    }
    handleIdx = handleIdx || this.activeHandleIdx || 0;
    if (this.initialized && this.restricted) {
      if ((handleIdx>0) && (sliderValue<this.values[handleIdx-1]))
        sliderValue = this.values[handleIdx-1];
      if ((handleIdx < (this.handles.length-1)) && (sliderValue>this.values[handleIdx+1]))
        sliderValue = this.values[handleIdx+1];
    }
    sliderValue = this.getNearestValue(sliderValue);
    this.values[handleIdx] = sliderValue;
    this.value = this.values[0]; // assure backwards compat

    this.handles[handleIdx].style[this.isVertical() ? 'top' : 'left'] =
      this.translateToPx(sliderValue);

    this.drawSpans();
    if (!this.dragging || !this.event) this.updateFinished();
  },
  setValueBy: function(delta, handleIdx) {
    this.setValue(this.values[handleIdx || this.activeHandleIdx || 0] + delta,
      handleIdx || this.activeHandleIdx || 0);
  },
  translateToPx: function(value) {
    return Math.round(
      ((this.trackLength-this.handleLength)/(this.range.end-this.range.start)) *
      (value - this.range.start)) + "px";
  },
  translateToValue: function(offset) {
    return ((offset/(this.trackLength-this.handleLength) *
      (this.range.end-this.range.start)) + this.range.start);
  },
  getRange: function(range) {
    var v = this.values.sortBy(Prototype.K);
    range = range || 0;
    return $R(v[range],v[range+1]);
  },
  minimumOffset: function(){
    return(this.isVertical() ? this.alignY : this.alignX);
  },
  maximumOffset: function(){
    return(this.isVertical() ?
      (this.track.offsetHeight != 0 ? this.track.offsetHeight :
        this.track.style.height.replace(/px$/,"")) - this.alignY :
      (this.track.offsetWidth != 0 ? this.track.offsetWidth :
        this.track.style.width.replace(/px$/,"")) - this.alignX);
  },
  isVertical:  function(){
    return (this.axis == 'vertical');
  },
  drawSpans: function() {
    var slider = this;
    if (this.spans)
      $R(0, this.spans.length-1).each(function(r) { slider.setSpan(slider.spans[r], slider.getRange(r)) });
    if (this.options.startSpan)
      this.setSpan(this.options.startSpan,
        $R(0, this.values.length>1 ? this.getRange(0).min() : this.value ));
    if (this.options.endSpan)
      this.setSpan(this.options.endSpan,
        $R(this.values.length>1 ? this.getRange(this.spans.length-1).max() : this.value, this.maximum));
  },
  setSpan: function(span, range) {
    if (this.isVertical()) {
      span.style.top = this.translateToPx(range.start);
      span.style.height = this.translateToPx(range.end - range.start + this.range.start);
    } else {
      span.style.left = this.translateToPx(range.start);
      span.style.width = this.translateToPx(range.end - range.start + this.range.start);
    }
  },
  updateStyles: function() {
    this.handles.each( function(h){ Element.removeClassName(h, 'selected') });
    Element.addClassName(this.activeHandle, 'selected');
  },
  startDrag: function(event) {
    if (Event.isLeftClick(event)) {
      if (!this.disabled){
        this.active = true;

        var handle = Event.element(event);
        var pointer  = [Event.pointerX(event), Event.pointerY(event)];
        var track = handle;
        if (track==this.track) {
          var offsets  = this.track.cumulativeOffset();
          this.event = event;
          this.setValue(this.translateToValue(
           (this.isVertical() ? pointer[1]-offsets[1] : pointer[0]-offsets[0])-(this.handleLength/2)
          ));
          var offsets  = this.activeHandle.cumulativeOffset();
          this.offsetX = (pointer[0] - offsets[0]);
          this.offsetY = (pointer[1] - offsets[1]);
        } else {
          while((this.handles.indexOf(handle) == -1) && handle.parentNode)
            handle = handle.parentNode;

          if (this.handles.indexOf(handle)!=-1) {
            this.activeHandle    = handle;
            this.activeHandleIdx = this.handles.indexOf(this.activeHandle);
            this.updateStyles();

            var offsets  = this.activeHandle.cumulativeOffset();
            this.offsetX = (pointer[0] - offsets[0]);
            this.offsetY = (pointer[1] - offsets[1]);
          }
        }
      }
      Event.stop(event);
    }
  },
  update: function(event) {
   if (this.active) {
      if (!this.dragging) this.dragging = true;
      this.draw(event);
      if (Prototype.Browser.WebKit) window.scrollBy(0,0);
      Event.stop(event);
   }
  },
  draw: function(event) {
    var pointer = [Event.pointerX(event), Event.pointerY(event)];
    var offsets = this.track.cumulativeOffset();
    pointer[0] -= this.offsetX + offsets[0];
    pointer[1] -= this.offsetY + offsets[1];
    this.event = event;
    this.setValue(this.translateToValue( this.isVertical() ? pointer[1] : pointer[0] ));
    if (this.initialized && this.options.onSlide)
      this.options.onSlide(this.values.length>1 ? this.values : this.value, this);
  },
  endDrag: function(event) {
    if (this.active && this.dragging) {
      this.finishDrag(event, true);
      Event.stop(event);
    }
    this.active = false;
    this.dragging = false;
  },
  finishDrag: function(event, success) {
    this.active = false;
    this.dragging = false;
    this.updateFinished();
  },
  updateFinished: function() {
    if (this.initialized && this.options.onChange)
      this.options.onChange(this.values.length>1 ? this.values : this.value, this);
    this.event = null;
  }
});
/* Copyright (c) 2006 Yahoo! Inc. All rights reserved. */

var YAHOO = function() { return {util: {}} } ();
YAHOO.util.Color = new function() {

  this.hsv2rgb = function (h, s, v) {
    var r, g, b;
    if ( s == 0 ) {
      r = v * 255;
      g = v * 255;
      b = v * 255;
    } else {

      var var_h = h * 6;
      if ( var_h == 6 ) {
        var_h = 0;
      }

      var var_i = Math.floor( var_h );
      var var_1 = v * ( 1 - s );
      var var_2 = v * ( 1 - s * ( var_h - var_i ) );
      var var_3 = v * ( 1 - s * ( 1 - ( var_h - var_i ) ) );

      if ( var_i == 0 ) {
        var_r = v;
        var_g = var_3;
        var_b = var_1;
      } else if ( var_i == 1 ) {
        var_r = var_2;
        var_g = v;
        var_b = var_1;
      } else if ( var_i == 2 ) {
        var_r = var_1;
        var_g = v;
        var_b = var_3
      } else if ( var_i == 3 ) {
        var_r = var_1;
        var_g = var_2;
        var_b = v;
      } else if ( var_i == 4 ) {
        var_r = var_3;
        var_g = var_1;
        var_b = v;
      } else {
        var_r = v;
        var_g = var_1;
        var_b = var_2
      }

      r = var_r * 255          //rgb results = 0 ÷ 255
      g = var_g * 255
      b = var_b * 255

      }
    return [Math.round(r), Math.round(g), Math.round(b)];
  };

  this.rgb2hsv = function (r, g, b) {
      var r = ( r / 255 );                   //RGB values = 0 ÷ 255
      var g = ( g / 255 );
      var b = ( b / 255 );

      var min = Math.min( r, g, b );    //Min. value of RGB
      var max = Math.max( r, g, b );    //Max. value of RGB
      deltaMax = max - min;             //Delta RGB value

      var v = max;
      var s, h;
      var deltaRed, deltaGreen, deltaBlue;

      if ( deltaMax == 0 )                     //This is a gray, no chroma...
      {
         h = 0;                               //HSV results = 0 ÷ 1
         s = 0;
      }
      else                                    //Chromatic data...
      {
         s = deltaMax / max;

         deltaRed = ( ( ( max - r ) / 6 ) + ( deltaMax / 2 ) ) / deltaMax;
         deltaGreen = ( ( ( max - g ) / 6 ) + ( deltaMax / 2 ) ) / deltaMax;
         deltaBlue = ( ( ( max - b ) / 6 ) + ( deltaMax / 2 ) ) / deltaMax;

         if      ( r == max ) h = deltaBlue - deltaGreen;
         else if ( g == max ) h = ( 1 / 3 ) + deltaRed - deltaBlue;
         else if ( b == max ) h = ( 2 / 3 ) + deltaGreen - deltaRed;

         if ( h < 0 ) h += 1;
         if ( h > 1 ) h -= 1;
      }

      return [h, s, v];
  }

  this.rgb2hex = function (r,g,b) {
    return this.toHex(r) + this.toHex(g) + this.toHex(b);
  };

  this.hexchars = "0123456789ABCDEF";

  this.toHex = function(n) {
    n = n || 0;
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    n = Math.round(Math.min(Math.max(0, n), 255));

    return this.hexchars.charAt((n - n % 16) / 16) + this.hexchars.charAt(n % 16);
  };

  this.toDec = function(hexchar) {
    return this.hexchars.indexOf(hexchar.toUpperCase());
  };

  this.hex2rgb = function(str) {
    var rgb = [];
    rgb[0] = (this.toDec(str.substr(0, 1)) * 16) +
            this.toDec(str.substr(1, 1));
    rgb[1] = (this.toDec(str.substr(2, 1)) * 16) +
            this.toDec(str.substr(3, 1));
    rgb[2] = (this.toDec(str.substr(4, 1)) * 16) +
            this.toDec(str.substr(5, 1));
    return rgb;
  };

  this.isValidRGB = function(a) {
    if ((!a[0] && a[0] !=0) || isNaN(a[0]) || a[0] < 0 || a[0] > 255) return false;
    if ((!a[1] && a[1] !=0) || isNaN(a[1]) || a[1] < 0 || a[1] > 255) return false;
    if ((!a[2] && a[2] !=0) || isNaN(a[2]) || a[2] < 0 || a[2] > 255) return false;

    return true;
  };
}


/*
   colorPicker for script.aculo.us, version 1.0
   REQUIRES prototype.js, yahoo.color.js and script.aculo.us
   written by Matthias Platzer AT knallgrau.at
   for a detailled documentation go to http://www.knallgrau.at/code/colorpicker
 */

if(!Control) var Control = {};
Control.colorPickers = [];
Control.ColorPicker = Class.create();
Control.ColorPicker.activeColorPicker;
Control.ColorPicker.CONTROL;
/**
 * ColorPicker Control allows you to open a little inline popUp HSV color chooser.
 * This control is bound to an input field, that holds a hex value.
 */
Control.ColorPicker.prototype = {
  initialize : function(field, options) {
    var colorPicker = this;
    Control.colorPickers.push(colorPicker);
    this.field = $(field);
    this.fieldName = this.field.name || this.field.id;
    this.options = Object.extend({
       IMAGE_BASE : "img/"
    }, options || {});
    this.swatch = $(this.options.swatch) || this.field;
		this.defaultColor = this.options.defaultColor || '000000';
    this.rgb = {};
    this.hsv = {};
    this.isOpen = false;

    if (!Control.ColorPicker.CONTROL) {
      Control.ColorPicker.CONTROL = {};
      if (!$("colorpicker")) {
        var control = Builder.node('div', {id: 'colorpicker'});
        control.innerHTML =
          '<div id="colorpicker-div">' + (
            (/MSIE ((6)|(5\.5))/gi.test(navigator.userAgent) && /windows/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) ?
              '<img id="colorpicker-bg" src="' + this.options.IMAGE_BASE + 'blank.gif" style="filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\'' + this.options.IMAGE_BASE + 'pickerbg.png\', sizingMethod=\'scale\')" alt="">' :
              '<img id="colorpicker-bg" src="' + this.options.IMAGE_BASE + 'pickerbg.png" alt="">'
             ) +
          '<div id="colorpicker-bg-overlay" style="z-index: 1002;"></div>' +
          '<div id="colorpicker-selector"><img src="' + this.options.IMAGE_BASE + 'select.gif" width="11" height="11" alt="" /></div></div>' +
          '<div id="colorpicker-hue-container"><img src="' + this.options.IMAGE_BASE + 'hue.png" id="colorpicker-hue-bg-img"><div id="colorpicker-hue-slider"><div id="colorpicker-hue-thumb"><img src="' + this.options.IMAGE_BASE + 'hline.png"></div></div></div>' +
          '<div id="colorpicker-footer"><span id="colorpicker-value">#<input type="text" onclick="this.select()" id="colorpicker-value-input" name="colorpicker-value" value=""></input></span><button id="colorpicker-okbutton">Done</button><button id="colorpicker-resetbutton">Reset</button></div>'
        document.body.appendChild(control);
      }
      Control.ColorPicker.CONTROL = {
        popUp : $("colorpicker"),
        pickerArea : $('colorpicker-div'),
        selector : $('colorpicker-selector'),
        okButton : $("colorpicker-okbutton"),
			 	resetButton : $("colorpicker-resetbutton"),
        value : $("colorpicker-value"),
        input : $("colorpicker-value-input"),
        picker : new Draggable($('colorpicker-selector'), {
          snap: function(x, y) {
            return [
              Math.min(Math.max(x, 0), Control.ColorPicker.activeColorPicker.control.pickerArea.offsetWidth),
              Math.min(Math.max(y, 0), Control.ColorPicker.activeColorPicker.control.pickerArea.offsetHeight)
            ];
          },
          zindex: 1009,
          change: function(draggable) {
            var pos = draggable.currentDelta();
            Control.ColorPicker.activeColorPicker.update(pos[0], pos[1]);
          }
        }),
        hueSlider: new Control.Slider('colorpicker-hue-thumb', 'colorpicker-hue-slider', {
          axis: 'vertical',
          onChange: function(v) {
            Control.ColorPicker.activeColorPicker.updateHue(v);
          }
        })
      };
      Element.hide($("colorpicker"));
    }
    this.control = Control.ColorPicker.CONTROL;

    this.toggleOnClickListener = this.toggle.bindAsEventListener(this);
    this.updateOnChangeListener = this.updateFromFieldValue.bindAsEventListener(this);
    this.closeOnClickOkListener = this.close.bindAsEventListener(this);
    this.updateOnClickPickerListener = this.updateSelector.bindAsEventListener(this);
		this.resetOnClickListener = this.reset.bindAsEventListener(this);


    Event.observe(this.swatch, "click", this.toggleOnClickListener);
    Event.observe(this.field, "change", this.updateOnChangeListener);
    Event.observe(this.control.input, "change", this.updateOnChangeListener);

    this.updateSwatch();
  },
	reset : function(event) {
		this.control.input.setValue(this.defaultColor);
		this.field.setValue(this.defaultColor);
    this.swatch.setStyle({backgroundColor: '#' + this.defaultColor})
		this.close()
	},
  toggle : function(event) {
    this[(this.isOpen) ? "close" : "open"](event);
    Event.stop(event);
  },
  open : function(event) {
    Control.colorPickers.each(function(colorPicker) {
      colorPicker.close();
    });
    Control.ColorPicker.activeColorPicker = this;
    this.isOpen = true;
    Element.show(this.control.popUp);
    if (this.options.getPopUpPosition) {
       var pos = this.options.getPopUpPosition.bind(this)(event);
    } else {
      var pos = Position.cumulativeOffset(this.swatch || this.field);
      pos[0] = (pos[0] + (this.swatch || this.field).offsetWidth + 10);
    }
    this.control.popUp.style.left = (pos[0]) + "px";
    this.control.popUp.style.top = (pos[1]) + "px";
    this.updateFromFieldValue();
    Event.observe(this.control.okButton, "click", this.closeOnClickOkListener);
    Event.observe(this.control.pickerArea, "mousedown", this.updateOnClickPickerListener);
		Event.observe(this.control.resetButton, "click", this.resetOnClickListener);
    if (this.options.onOpen) this.options.onOpen.bind(this)(event);
  },
  close : function(event) {
    if (Control.ColorPicker.activeColorPicker == this) Control.ColorPicker.activeColorPicker = null;
    this.isOpen = false;
    Element.hide(this.control.popUp);
    Event.stopObserving(this.control.okButton, "click", this.closeOnClickOkListener);
    Event.stopObserving(this.control.pickerArea, "mousedown", this.updateOnClickPickerListener);
		Event.stopObserving(this.control.resetButton, "click", this.resetOnClickListener);
    if (this.options.onClose) this.options.onClose.bind(this)();
  },
  updateHue : function(v) {
    var h = (this.control.pickerArea.offsetHeight - v * 100) / this.control.pickerArea.offsetHeight;
    if (h == 1) h = 0;
    var rgb = YAHOO.util.Color.hsv2rgb( h, 1, 1 );
    if (!YAHOO.util.Color.isValidRGB(rgb)) return;
    this.control.pickerArea.style.backgroundColor = "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
    this.update();
  },
  updateFromFieldValue : function(event) {
    if (!this.isOpen) return;
    var field = (event && Event.findElement(event, "input")) || this.field;
    var rgb = YAHOO.util.Color.hex2rgb( field.value );
    if (!YAHOO.util.Color.isValidRGB(rgb)) return;
    var hsv = YAHOO.util.Color.rgb2hsv( rgb[0], rgb[1], rgb[2] );
    this.control.selector.style.left = Math.round(hsv[1] * this.control.pickerArea.offsetWidth) + "px";
    this.control.selector.style.top = Math.round((1 - hsv[2]) * this.control.pickerArea.offsetWidth) + "px";
    this.control.hueSlider.setValue((1 - hsv[0]));
  },
  updateSelector : function(event) {
    var xPos = Event.pointerX(event);
    var yPos = Event.pointerY(event);
    var pos = Position.cumulativeOffset($("colorpicker-bg"));
    this.control.selector.style.left = (xPos - pos[0] - 6) + "px";
    this.control.selector.style.top = (yPos - pos[1] - 6) + "px";
    this.update((xPos - pos[0]), (yPos - pos[1]));
    this.control.picker.initDrag(event);
  },
  updateSwatch : function() {
    var rgb = YAHOO.util.Color.hex2rgb( this.field.value );
    if (!YAHOO.util.Color.isValidRGB(rgb)) return;
    this.swatch.style.backgroundColor = "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
    var hsv = YAHOO.util.Color.rgb2hsv( rgb[0], rgb[1], rgb[2] );
    this.swatch.style.color = (hsv[2] > 0.65) ? "#000000" : "#FFFFFF";
  },
  update : function(x, y) {
    if (!x) x = this.control.picker.currentDelta()[0];
    if (!y) y = this.control.picker.currentDelta()[1];

    var h = (this.control.pickerArea.offsetHeight - this.control.hueSlider.value * 100) / this.control.pickerArea.offsetHeight;
    if (h == 1) { h = 0; };
    this.hsv = {
      hue: 1 - this.control.hueSlider.value,
      saturation: x / this.control.pickerArea.offsetWidth,
      brightness: (this.control.pickerArea.offsetHeight - y) / this.control.pickerArea.offsetHeight
    };
    var rgb = YAHOO.util.Color.hsv2rgb( this.hsv.hue, this.hsv.saturation, this.hsv.brightness );
    this.rgb = {
      red: rgb[0],
      green: rgb[1],
      blue: rgb[2]
    };
    this.field.value = YAHOO.util.Color.rgb2hex(rgb[0], rgb[1], rgb[2]);
    this.control.input.value = this.field.value;
    this.updateSwatch();
    if (this.options.onUpdate) this.options.onUpdate.bind(this)(this.field.value);
  }
}
var iframeCounter = 0

Element.addMethods('form', {
  hasFileUploads: function(form) {
    return $(form).select('input[type=file]').any(function(input) {
      return input.getValue()
    })
  },
  hasEmptyFileUploads: function(form) {
    return $(form).select('input[type=file]').any(function(input) {
      return input.value == ''
    })
  },
  isDirty: function(form) {
    form = $(form)
    return form.hasFileUploads() ||
      form.select('textarea').any(function(area) { return area.getValue() != area.innerHTML }) ||
      form.select('input:not([type=submit],[type=hidden],[type=checkbox],[type=radio])').
        any(function(input) { return input.getValue() != (input.readAttribute('value') || '') }) ||
      form.select('select').any(function(select) {
        option = select.down('option[selected]') || select.down('option')
        select.getValue() != option.value
      })
  }
})

document.on('ajax:create', 'form.new_conversation, .thread form', function(e) {
  e.memo.request.options.requestHeaders = {'Accept': 'text/html'}
})

document.on('ajax:before', 'form.new_conversation, form.new_task, .thread form, #facebox form.edit_comment', function(e, form) {
  if (form.hasFileUploads()) {
    e.stop()

    var iframeID = 'file_upload_iframe' + (iframeCounter++)
    var iframe = new Element('iframe', { id: iframeID, name: iframeID }).hide()
    $(document.body).insert(iframe)
    form.target = iframeID
    form.insert(new Element('input', { type: 'hidden', name: 'iframe', value: 'true' }))

    var authToken = $$('meta[name=csrf-token]').first().readAttribute('content'),
    authParam = $$('meta[name=csrf-param]').first().readAttribute('content')
    if (form[authParam]) {
      form[authParam].value = authToken }
    else {
      var token = new Element('input', { type: 'hidden', name: authParam, value: authToken }).hide()
      form.insert(token)
    }

    var callback = function() {
      var iframeBody = (iframe.contentDocument || iframe.contentWindow.document).body

      if (iframeBody.className == "error") {
        var json = iframeBody.firstChild.innerHTML.evalJSON()
        form.fire('ajax:failure', {responseJSON: json})
      } else {
        form.fire('ajax:success', {responseText: iframeBody.innerHTML})
      }

      form.fire('ajax:complete')
      iframe.remove()
      form.target = null
      var extraInput = form.down('input[name=iframe]')
      if (extraInput) extraInput.remove()
    }

    iframe.onreadystatechange = function() {
      if (this.readyState == 'complete') callback()
    }
    iframe.onload = callback

    form.submit()
  }
})

function resetCommentsForm(form) {
  form.down('textarea[name*="[body]"]').setValue('').setStyle({ height: '' })
  form.select('input[type=file]').each(function(input) {
    if (input.getValue()) input.remove()
  })
  var private_opts = form.down('.private_options');
  if (private_opts) {
	private_opts.childElements().invoke('remove');
	private_opts.hide();
	var trigger = form.down('.private_switch');
	if (trigger) trigger.removeAttribute('form-present');
  }
  var hours = form.down('input[name*="[human_hours]"]')
  if (hours) hours.setValue('')
  form.select('.hours_field, .upload_area').invoke('hide')
  form.select('.error').invoke('remove')
  form.select('.google_docs_attachment .fields input').invoke('remove')
  form.select('.google_docs_attachment .file_list li').invoke('remove')
}

document.on('ajax:success', 'form.new_conversation', function(e, form) {
  resetCommentsForm(form);
  $('activities').insert({top: e.memo.responseText}).down('.thread').highlight({ duration: 1 });
  Task.insertAssignableUsers();

  my_user.stats.conversations++;
  document.fire("stats:update");

  disableConversationHttpMethodField();
})

document.on('ajax:success', '.thread .comments .more_comments', function(e, el) {
  el.up('.comments').update(e.memo.responseText).blindDown({ duration: 0.5 })
})

document.on('click', '.thread .comments .more_comments a', function(e, el) {
  el.update("<img src='/images/loading.gif'/>")
})

document.on('ajax:success', '.thread form:not(.not-new-comment)', function(e, form) {
  resetCommentsForm(form)
  var comment_data = e.memo.responseText
  var conversation_data = e.memo.headerJSON
  var thread = form.up('.thread')

  if (conversation_data) {
    if (conversation_data.is_private) {
      if (!thread.hasClassName('private'))
        thread.addClassName('private')
    } else {
      thread.removeClassName('private')
    }

    thread.writeAttribute('data-user-id', conversation_data.user_id)
    thread.writeAttribute('data-watcher-ids', (conversation_data.watchers||[]).join(','))
  }

  if (!e.memo.responseText.blank()) {
    var new_comment = thread.down('.comments').insert(e.memo.responseText).down('.comment:last-child')
    new_comment.highlight({ duration: 1 })

    var body = new_comment.down('.body'),
        start = (body.down('.assigned_transition') || body.down('.before')),
        excerpt = start.nextSiblings().map(function(e){return e.innerHTML}).join(' ').stripTags()
    thread.down('.comment_header').
           down('.excerpt').
           update('<strong>' + body.down('.before').down('.user').innerHTML + '</strong> ' + excerpt)
  }
  my_user.stats.conversations++;
  document.fire("stats:update");
})

document.on('ajax:failure', 'form.new_conversation, .thread form:not(.not-new-comment)', function(e, form) {
  var message = $H(e.memo.responseJSON)
	message.each( function(error) {
		form.down('div.text_area').insertOrUpdate('p.error', error.value)
	})
})

document.on('ajax:success', '#facebox form.edit_comment', function(e, form) {
  var commentID = form.readAttribute('action').match(/\d+/g).last()
  $('comment_' + commentID).replace(e.memo.responseText)
  Prototype.Facebox.close()
  $('comment_' + commentID).highlight()
})

document.on('ajax:success', '.comment:not(div[data-class=conversation].thread .comment) .actions_menu a[data-method=delete]', function(e, link) {
  e.findElement('.comment').remove()
})

document.on('ajax:success', 'div[data-class=conversation].thread .comment .actions_menu a[data-method=delete]', function(e, link) {
	var conversation = e.findElement('.thread')
	if (conversation.select('.comment').length == 1 && conversation.select('.title').length == 0) conversation.remove()
	else e.findElement('.comment').remove()
})

hideBySelector('form .upload_area')

document.on('click', 'form .attach_icon', function(e, link) {
  if (!e.isMiddleClick()) {
    link.up('form').down('.upload_area').forceShow().highlight()
    e.stop()
  }
})

hideBySelector('form .hours_field')

document.on('click', 'form .add_hours_icon', function(e, link) {
  link.up('form').down('.hours_field').forceShow().down('input').focus()
  e.stop()
})

document.on('mouseover', '.textilized a', function(e, link) {
  link.writeAttribute("target", "_blank");
});

hideBySelector('#activities .thread form.new_comment .extra')

document.on('focusin', '#activities .thread form.new_comment textarea', function(e, input) {
  var form = input.up('form')
  var extra = form.down('.extra')
  extra.forceShow()
})


document.on('focusin', 'form textarea[name*="[body]"]', function(e, input) {
  var form = e.findElement('form'),
      project = form.readAttribute('data-project-id')

  if (!project) {
    var projectSelect = form.down('select[name=project_id]')
    if (projectSelect) project = projectSelect.getValue()
  }

  if (project) {
    var people = _people[project],
        autocompleter = input.retrieve('autocompleter'),
        all = "@all <span class='informal'>" + I18n.translations.conversations.watcher_fields.people_all + "</span>"

    people = [all].concat(people.collect(function (p) {
      return "@" + p[1] + " <span class='informal'>" + p[2] + "</span>"
    }))
    if (autocompleter) {
      autocompleter.options.array = people
    } else {
      var container = new Element('div', { 'class': 'autocomplete' }).hide()
      input.insert({ after: container })
      autocompleter = new Autocompleter.Local(input, container, people, { tokens:[' '] })
      input.store('autocompleter', autocompleter)
    }
  }
})

document.on('focusin', 'form#new_invitation input#invitation_user_or_email', function(e, input) {
  var form = e.findElement('form')
  var people = (new Hash(_people_autocomplete)).values().flatten().uniq().reject(function(e) { return e.match('@all') }),
    autocompleter = input.retrieve('autocompleter')

  if (autocompleter) {
    autocompleter.options.array = people
  } else {
    var container = new Element('div', { 'class': 'autocomplete' }).hide()
    input.insert({ after: container })
    autocompleter = new Autocompleter.Local(input, container, people, { tokens:[' '] })
    input.store('autocompleter', autocompleter)
  }
})

ActivityFeed = {
  collapseAll: function() {
    var activities = $('activities');
    if (activities) {
      $$('#activities .activity, #activities .thread').invoke("addClassName", "collapsed");
      activities.addClassName("collapsed");
      this.collapsed = true;
    }
  },
  expandAll: function() {
    var activities = $('activities');
    if (activities) {
      $$('#activities .activity, #activities .thread').invoke("removeClassName", "collapsed");
      activities.removeClassName("collapsed");
      this.collapsed = false;
    }
  },
  toggle: function(el) {
    el.toggleClassName("collapsed");
    Threads.select(el);
    Threads.ensureVisible(el);
  },
  collapsed: false
};

document.on("click", "a.collapsed_mode", function(e,el) {
  e.stop();
  ActivityFeed.collapseAll();
  $$('a.collapsed_mode')[0].up('.el').toggle();
  $$('a.expanded_mode')[0].up('.el').toggle();
  var r = new Ajax.Request('/account/activity_feed_mode/collapsed');
});

document.on("click", "a.expanded_mode", function(e,el) {
  e.stop();
  ActivityFeed.expandAll();
  $$('a.collapsed_mode')[0].up('.el').toggle();
  $$('a.expanded_mode')[0].up('.el').toggle();
  var r = new Ajax.Request('/account/activity_feed_mode/expanded');
});

document.on("click", "#activities .comment_header", function(e,el) {
  ActivityFeed.toggle(el.up('.thread'));
});

document.on("click", "#activities .comment_header a", function(e,el) {
  ActivityFeed.toggle(el.up('.thread'));
  if (e.isMiddleClick()) { return; }
  if (!el.up('.project_overlay')) {
    e.stop();
    window.location = el.readAttribute("href");
  }
});

document.on("dom:loaded", function() {
  if (my_user.collapse_activities && $$('a.collapsed_mode').any()) {
    ActivityFeed.collapseAll();
    $$('a.collapsed_mode').first().up('.el').toggle();
    $$('a.expanded_mode').first().up('.el').toggle();
  }
});

document.on('click', '.conversation_header .text_actions a[href$="/edit"]', function(e, link) {
  e.stop()
  link.up('.conversation_header').hide().next('form.edit_conversation').forceShow()
})

document.on('click', '.edit_conversation a[href="#cancel"]', function(e, link) {
  e.stop()
  link.up('.edit_conversation').hide().previous('.conversation_header').show()
})

document.on('ajax:success', 'form.edit_conversation:not(.convert-to-task)', function(e, form) {
  var name = form.down('input[name="conversation[name]"]').getValue()
  form.up('.content').select('.conversation_header h2, .conversation .thread_title a').invoke('update', name)

  var header = form.previous('.conversation_header');
  if (header) {
    form.hide();
    header.show();
  }
});

document.on('ajax:success', 'form.edit_conversation.convert-to-task', function(e, form) {
  var person = form['conversation[assigned_id]'].getValue();
  var task_count = Number($('open_my_tasks').innerHTML)
  var is_assigned_to_me = my_projects[person]

  if (is_assigned_to_me) {
    task_count += 1
    $('open_my_tasks').update(task_count)
  }
  if ($$('.conversation_header').length == 1) {
    document.location.href = e.memo.responseText;
  }
  else {
    e.element().up('.thread').update(e.memo.responseText).highlight({ duration: 2 })
    Task.insertAssignableUsers();
  }
});

document.on('ajax:failure', 'form.edit_conversation.convert-to-task', function(e, form) {
  var message = $H(e.memo.responseJSON)
	message.each( function(error) {
    form.down('#conversation_name').insert({after: "<p class='error'>" + message + "</p>"})
	})
})


document.on('click', '#user_all', function(e, el) {
  var target = e.element();
  var enabled = target.checked;
  $$('.watchers .user input').each(function(el){
    el.checked = enabled;
  });
});

document.on('click', '.watchers .user input', function(e, el) {
  var target = e.element();
  if (!target.checked)
    $('user_all').checked = false;
});


var toggleConvertToTaskForm = function(e, el, recurse) {
  e.stop();

  var form = el.up('form.new_comment.edit_conversation'),
      target = form.down('span.convert_to_task a'),
      panel = form.down('div.convert_to_task'),
      submit = form.down('.submit', 1),
      google_docs = form.down('.google_docs_attachment');
      attach = form.down('.attach');
  panel.select('select,input').each(function(e) {e.disabled = !e.disabled;});

  panel.select('input[type=submit]').each(function(input) {
    if (!form.down('select').disabled) {
      input.disabled = false;
    }
  });

  panel.select('#conversation_task_list_id').each(function(select) {
    if (select.options[0].value == '' && !recurse) {
      var projectId = select.up('form').getAttribute('data-project-id');
      TaskList.populateTaskListSelect(projectId, select, function() {
        toggleConvertToTaskForm(e,el,true);
      });
    }
  });

  form.select('input[name=_method]').each(function(input) {
    input.disabled = !input.disabled;
  });

  form.toggleClassName('not-new-comment');
  form.toggleClassName('convert-to-task');

  form.toggleClassName('required');

  if (form.action.endsWith('/convert_to_task')) {
    form.action = form.action.gsub(/\/convert_to_task/,'/comments');
  }
  else {
    form.action = form.action.gsub(/\/comments/,'');
    form.action = form.action + '/convert_to_task';
  }

  [target,panel,submit,attach,google_docs].invoke('toggle');
};

document.on('click', 'span.convert_to_task a', toggleConvertToTaskForm);
document.on('click', 'div.convert_to_task a.cancel', toggleConvertToTaskForm);

var disableConversationHttpMethodField = function(e) {
  $$('form.new_comment.edit_conversation input[name=_method]').each(function(input) {
    input.disabled = true;
  });
}

document.observe('dom:loaded', disableConversationHttpMethodField);
document.on('ajax:success', '.teambox_data a[data-method="delete"]', function(e, link) {
  link.up('.teambox_data').remove();
})

document.on('focusin', 'form.edit_teambox_data input.user', function(e, input) {
  var form = e.findElement('form')
  var people = (new Hash(_import_users_autocomplete)).values().flatten().uniq(),
    autocompleter = input.retrieve('autocompleter')

  if (autocompleter) {
    autocompleter.options.array = people
  } else {
    var container = new Element('div', { 'class': 'autocomplete' }).hide()
    input.insert({ after: container })
    autocompleter = new Autocompleter.Local(input, container, people, { tokens:[' '] })
    input.store('autocompleter', autocompleter)
  }
})
document.on('ajax:success', '.client_token a.revoke', function(e, link) {
  link.up('.client_token').remove();
})

document.on('click', '#oauth_authorize_form .allow', function(e, link) {
  var form = link.up('form')
  var authorize = form.down('input[name=authorize]')
  authorize.value = '1'
  form.submit();
})

document.on('click', '#oauth_authorize_form .deny', function(e, link) {
  var form = link.up('form')
  var authorize = form.down('input[name=authorize]')
  authorize.value = '0'
  form.submit();
})
if(typeof(I18n) == 'undefined') { I18n = {}; };

I18n.MATCH = /%\{([^\}]+)\}/g
I18n.t = function(key, opts) {
  return key.replace(I18n.MATCH, function(match, subst) {
      return opts[subst]||''
  })
}

Date.months = I18n.translations.date.month_names.compact();
Date.weekdays = I18n.translations.calendar.abbr_weekdays;
Date.firstDayOfWeek = "sunday";

document.on("dom:loaded", function() {
  if(!my_user) { return; }
  Date.firstDayOfWeek = my_user.first_day_of_week;
  Date.first_day_of_week = my_user.first_day_of_week == 'sunday' ? 0 : 1;
  if(Date.firstDayOfWeek == "monday") {
    Date.weekdays.push(Date.weekdays.shift());
  }
});

_translations = $w("OK Now Today Clear").inject({}, function(h, w) {
  h[w] = I18n.translations.calendar[w.toLowerCase()];
  return h;
});

Object.extend(Date.prototype, {
  beginning_of_day: function() {
    var date = new Date(this);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  },

  beginning_of_next_day: function() {
    var date = this.add_days(1)
    date.setHours(0)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    return date
  },

  add_days: function(interval) {
    var date = new Date(this)
    date.setDate(this.getDate() + interval)
    return date
  },

  add_weeks: function(interval) {
    return this.add_days(interval*7)
  },

  add_months: function(interval) {
    var date = new Date(this)
    date.setMonth(this.getMonth() + interval)
    return date
  },

  is_today: function() {
    var now = new Date()
    var today = now.beginning_of_day()
    var tomorrow = new Date(today).add_days(1)
    return (this >= today && this < tomorrow)
  },

  is_tomorrow: function() {
    var now = new Date()
    var tomorrow = now.beginning_of_day().add_days(1)
    var day_after = new Date(tomorrow).add_days(1)
    return (this >= tomorrow && this < day_after)
  },

  is_within: function(other_date) {
    var now = (new Date()).beginning_of_day()
    var extent = new Date(other_date).beginning_of_day()
    return (this >= now && this < extent)
  },

  days_since: function() {
    return Math.round(((new Date()).beginning_of_day() - this.beginning_of_day()) / 86400000.0)
  },

  strftime: function(format) {
    var minutes = this.getMinutes(),
        hours = this.getHours(),
        day = this.getDay(),
        month = this.getMonth(),
        t = I18n.translations;

    function pad(num) { return num.toPaddedString(2); }

    return format.gsub(/\%([aAbBcdDHiImMpSwyY])/, function(part) {
      switch(part[1]) {
        case 'a': return t.date.abbr_day_names[day];
        case 'A': return t.date.day_names[day];
        case 'b': return t.date.abbr_month_names[month+1];
        case 'B': return t.date.month_names[month+1];
        case 'c': return this.strftime("%a %b %d %H:%M:%S %Y");
        case 'd': return this.getDate();
        case 'D': return pad(this.getDate());
        case 'H': return pad(hours);
        case 'i': return (hours === 12 || hours === 0) ? 12 : (hours + 12) % 12;
        case 'I': return pad((hours === 12 || hours === 0) ? 12 : (hours + 12) % 12);
        case 'm': return pad(month + 1);
        case 'M': return pad(minutes);
        case 'p': return hours > 11 ? t.time.pm : t.time.am;
        case 'S': return pad(this.getSeconds());
        case 'w': return day;
        case 'y': return pad(this.getFullYear() % 100);
        case 'Y': return this.getFullYear().toString();
      }
    }.bind(this));
  },
  timeAgo: function(current_date) {
    current_date = current_date || new Date();

    var posted_date = new Date(this);
    var elapsed = current_date - posted_date;

    var minutes = Math.floor(elapsed / (1000 * 60));
    var days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    var today = (current_date.getDay() === posted_date.getDay() && days < 2);
    var t = I18n.translations;

    if (elapsed < 0) {
      return posted_date.strftime(t.date.formats.long); }
    else if (minutes === 0) {
      return t.datetime.distance_in_words.now; }
    else if (minutes == 1) {
      return t.datetime.time_ago.gsub("%{time_ago_in_words}", t.datetime.distance_in_words.x_minutes.one); }
    else if (minutes < 60) {
      return t.datetime.time_ago.gsub("%{time_ago_in_words}", t.datetime.distance_in_words.x_minutes.other.gsub("%{count}", minutes)); }
    else if (today) {
      return posted_date.strftime(t.time.formats.short); }
    else if (days == 1) {
      return t.date.yesterday + ' ' + posted_date.strftime(t.time.formats.short); }
    else if (days <= 14) {
      return posted_date.strftime("%a " + t.date.formats.short); }
    else if (current_date.getFullYear() == posted_date.getFullYear()) {
      return posted_date.strftime(t.date.formats.short);
    }
    else { return posted_date.strftime(t.date.formats.long); }
  }
});

Date.format_posted_dates = function() {
  $$('time.timeago').each(function(c){
    var date = new Date(parseInt(c.readAttribute('data-msec')));
    c.update(date.timeAgo());
  });
};

document.on("dom:loaded", function() {
  Date.format_posted_dates();
  new PeriodicalExecuter(Date.format_posted_dates, 30);
});

document.on("ajax:success", function() {
  Date.format_posted_dates.defer();
});

document.on('click', 'div.date_picker', function(e, element) {
  var field = element.down('input')
  var label = element.down('span')
  var parentDiv = element.up('div')
  var date_picker = DatePicker.initialize(field, label, parentDiv);
  if (element.hasClassName("show_urgent")) {
    DatePicker.add_urgent_box(date_picker, element, field, label, parentDiv);
  }
});

DatePicker = {
  initialize: function(field, label, parentDiv) {
    return(new CalendarDateSelect(field, {
      buttons: true,
      time: false,
      year_range: 10,
      embedded: false,
      close_on_click: true,
      popup_by: parentDiv,
      onchange: function() {
        selected_date = this.calendar_date_select.selected_date

        if ( /[\d]{4}-[\d]{1,2}-[\d]{1,2}\s[\d]{1,2}:[\d]{1,2}/.test(this.value) == true ) {
          localized_format = I18n.translations.time.formats.long
          localized_time = selected_date.strftime(localized_format)
        } else if ( /[\d]{4}-[\d]{1,2}-[\d]{1,2}/.test(this.value) == true ) {
          localized_format = I18n.translations.date.formats.long
          localized_time = selected_date.strftime(localized_format)
        } else {
          localized_time = this.value
        }
        label.update(localized_time || I18n.translations.date_picker.no_date_assigned);
      }
    }));
  },

  add_urgent_box: function(date_picker, element, field, label, parentDiv) {
    var urgent_field = field.parentNode.down("input.urgent");
    var html = Mustache.to_html(Templates.tasks.calendar_date_select_urgent_header, {
      task_id: element.id.split("_")[1]
    });
    date_picker.top_div.update(html);

    date_picker.top_div.down(".show-help").observe("click", function(event) {
      date_picker.top_div.down(".help").toggle();
      event.stop();
    });

    var update_urgent_box = function (date_picker, input_urgent, user_action) {
      urgent_field.value = input_urgent.checked ? "1" : "0";
      urgent_field.removeAttribute("disabled");

      if (input_urgent.checked) {
        label.update(I18n.translations.date_picker.urgent.short);
      } else if (user_action) {
        date_picker.clearDate();
        date_picker.callback("onchange");
        label.update(I18n.translations.date_picker.no_date_assigned);
      }

      if (user_action && input_urgent.checked) {
        date_picker.close();
      } else {
        date_picker.calendar_div.select("> div").each(function(div) {
          if (!div.hasClassName("cds_top")) {
            div[input_urgent.checked ? "hide" : "show"]();
          }
        });
      }
      date_picker.positionCalendarDiv();
    }

    var input_urgent = date_picker.top_div.down("input.urgent")
    input_urgent.checked = (urgent_field.value == "1");
    update_urgent_box(date_picker, input_urgent, false);
    input_urgent.observe("click", function() {
      update_urgent_box(date_picker, this, true);
    });
  }
}
contractComments = function() {
  $$('.comment').each(function(comment) {
    if (comment.measure("height") > 500) {
      if (!comment.down(".expand_comment")) {
        comment.down(".block").insert({
          bottom: "<div class='expand_comment'><a href='#'>This comment is too long to be displayed. Click for the full view.</a><span></span></div>"
        });
        comment.down(".block .body").setStyle({
          "height": "500px",
          "overflow-y": "hidden" });
      }
    }
  });
};

document.on("click", ".expand_comment", function(e,el) {
  e.stop();
  el.up(".comment").down(".body").setStyle({ "height": "auto" });
  el.remove();
});

document.on("dom:loaded", function() {
  contractComments();
});
Filter = {
  assigned_options: null,
  count_due_date: null,

  init: function() {
    var filter_assigned = $("filter_assigned")
    var filter_due_date = $("filter_due_date")
    var filter_tasks_by_name = $('filter_tasks_by_name')

    if (params("filter_assigned"))      filter_assigned.value      = params("filter_assigned")
    if (params("filter_due_date"))      filter_due_date.value      = params("filter_due_date")
    if (params("filter_tasks_by_name")) filter_tasks_by_name.value = params("filter_tasks_by_name")

    if (filter_assigned) Filter.assigned_options = Filter.initOptions(filter_assigned.options)
    if (filter_due_date) Filter.count_due_date = Filter.mapOptions(filter_due_date.options)
  },

  showAllTaskLists: function() {
    $$(".task_list_container").invoke('show')
  },
  showAllTasks: function() {
    $$(".tasks div.task").invoke('show')
    $$(".tasks.closed div.task").invoke('show')
  },
  hideAllTasks: function() {
    $$(".tasks div.task").invoke('hide')
    $$(".tasks.closed div.task").invoke('hide')
  },
  showTasks: function(by, filter) {
    $$(".tasks div.task."+by).each(function(e){
      if (filter == null || e.hasClassName(filter))
        e.show();
      else
        e.hide();
    });
  },
  countTasks: function(by, date_filter) {
    return $$(".tasks div.task." + by).select(function(e){
      return (date_filter == null || e.hasClassName(date_filter))
    }).length
  },
  hideTasks: function(by, filter) {
    $$("table.task_list div.task" + by).each(function(e){
      if (filter == null || e.hasClassName(filter))
        e.hide();
      else
        e.show();
    });
  },
  foldEmptyTaskLists: function() {
    $$("div.task_list").each(function(e) {
      var container = e.up('.task_list_container');
      if (container.hasClassName('archived'))
      {
        container.hide();
        return;
      }

      visible_tasks = e.select(".task").reject( function(e) {
        return e.getStyle("display") == "none";
      })
      if(visible_tasks.length == 0) {
        container.hide();
      }
    })
  },

  initOptions: function(assigned_options) {
    var out = [];
    len = assigned_options.length;
    for (var i=0; i<len; i++) {
        var option = assigned_options[i];
        out.push({value:option.value, text:option.text, disabled:option.disabled, count:0});
    };
    return out;
  },

  mapOptions: function(options) {
      var out = [];
      var len = options.length;
      for (var i=0; i<len; i++)
        out.push(options[i].text);
      return out;
  },

  updateFilters: function() {
    if (Filter.assigned_options == null && Filter.count_due_date == null)
      Filter.init();

    var el_name = $("filter_tasks_by_name")
    var el = $("filter_assigned");
    var el_filter = $("filter_due_date");
    if (el == null && el_filter == null) return;

    var name_match = el_name.value
    var assigned = el.value == 'all' ? 'task' : el.value;
    var filter = el_filter.value == 'all' ? null : el_filter.value;

    Filter.showAllTaskLists();
    Filter.hideAllTasks();

    if ((name_match == "" || name_match == el_name.readAttribute('placeholder')) && assigned == 'task' && filter == null)
    {
      Filter.showAllTasks();
    } else {
      Filter.showTasks(assigned, filter);
      if (name_match!=el_name.readAttribute("placeholder")) Filter.hideBySearchBox(name_match);
      Filter.foldEmptyTaskLists();
    }

    Filter.updateCounts(true);
  },

  hideBySearchBox: function(matchText) {
    matchText = matchText.toLowerCase()
    $$(".tasks div.task").each(function(t){
      if(!t.down('a.name').innerHTML.toLowerCase().match(matchText))
        t.hide()
    });
  },

  updateCounts: function(due_only) {
    if (Filter.assigned_options == null && Filter.count_due_date == null)
      Filter.init();

    var el = $("filter_assigned");
    var el_filter = $("filter_due_date");
    if (el == null)
      return;

    var current_assigned = el.value;
    var assigned = el.value == 'all' ? 'task' : el.value;
    var count_due_date = Filter.count_due_date;
    var assigned_options = Filter.assigned_options;
    var len;

    if (!due_only)
    {
      el.options.length = 0;
      len = assigned_options.length;
      var idx = 0;
      for (var i=0; i<len; i++)
      {
        var option = assigned_options[i];
        if (option.disabled) {
            el.options[idx] = new Option(option.text, option.value);
            el.options[idx].disabled = true;
            idx += 1;
        } else {
            var filter = option.value == 'all' ? 'task' : option.value;
            var count = Filter.countTasks(filter, null);
            if (i < 3 || count > 0 || filter == current_assigned) {
                el.options[idx] = (new Option(option.text + ' (' + count + ')', option.value));
                idx += 1;
            }
        }
      }
      el.value = current_assigned;
    }

    len = el_filter.options.length;
    for (var i=0; i<len; i++)
    {
      var option = el_filter.options[i];
      if (option.disabled)
        continue;
      var filter = option.value == 'all' ? null : option.value;
      option.text = count_due_date[i] + ' (' + Filter.countTasks(assigned, filter) + ')';
    }
  },

  populatePeopleForTaskFilter: function() {
    if ((typeof _people == "object") && (select = $('filter_assigned'))) {
      select.insert(new Element('option', { 'value': 'divider', 'disabled': true}).insert('--------'))
      var users = []
      var user_ids = []
      if (project_id = select.readAttribute('data-project-id') && project_id != 0) {
        users = _people[project_id].collect(function (e) { return [e[3],e[2]] })
      }
      else {
        (new Hash(_people)).values().each(function (project) {
          project.each(function(person) {
            if (!user_ids.include(person[3])) {
              users.push([person[3],person[2]])
              user_ids.push(person[3])
            }
          })
        })
      }
      users.sortBy(function(e) { return e[1] }).each(function(user) {
        var option = new Element('option', { 'value': 'user_' + user[0]}).insert(user[1])
        select.insert(option)
      })
    }
  }

};

document.on('keyup', '#filter_tasks_by_name', function(evt,el) {
  Filter.updateFilters();
}.throttle(200)) // throttling the function improves performance

document.on('click', '#filter_tasks_by_name', function(evt,el) {
  Filter.updateFilters();
})

document.on("change", "#filter_tasks_by_name, #filter_assigned, #filter_due_date", function(evt, el){
  Filter.updateFilters()
  print_link = $$('.print_link').first()
  print_link.href = 	window.location.href + '.print?filter_assigned=' + $('filter_assigned').value + '&filter_due_date=' + $('filter_due_date').value + '&filter_tasks_by_name='  + $('filter_tasks_by_name').value
});
FirstSteps = {
  steps: { completed: 0, total: 5 },
  show: function(where) {
    if (!my_user.show_badges) { return; }
    if (!my_user.first_steps) { return; }
    $$(".first_steps").invoke('remove');
    var html = Mustache.to_html(Templates.first_steps.overview);

    this.where = where || this.where || 'column';
    $(this.where).insert({ top: html });

    this.steps.completed = 0;
    $w("first_conversation first_task first_page first_project first_invite").each(function(name) {
      if(Badge.has(name)) { FirstSteps.activateStep(name); }
    });

    this.drawProgressBar();
    this.chooseLastUnaccomplishedStep();
  },
  activateStep: function(name) {
    var container = $$(".first_steps")[0];
    if (!container) { return; }
    var img = container.down("img[data-name='"+name+"']");
    img.src = img.src.gsub(/-disabled/, '');
    var step = img.readAttribute('data-step');
    container.down('.step'+step).innerHTML =
      container.down('.step'+step+'-complete').innerHTML;

    this.steps.completed++;
  },
  chooseStep: function(step_number) {
    var container = $$(".first_steps")[0];
    container.select('.step').invoke('hide');
    container.down('.step'+step_number).show();
    container.select('.steps img').invoke('removeClassName', 'active');
    container.down('img[data-step='+step_number+']').addClassName('active');
  },
  stepsCompleted: function() {
    var container = $$(".first_steps")[0];
    container.select('.step').invoke('hide');
    container.down('.completed').show();
    container.select('.steps img').invoke('removeClassName', 'active');
  },
  chooseLastUnaccomplishedStep: function() {
    var img =
      $$('.first_steps .steps img').detect(function(img) {
        return img.readAttribute('src').match(/disabled/);
      });
    if (img) {
      this.chooseStep(img.readAttribute('data-step'));
    } else {
      this.stepsCompleted();
    }
  },
  drawProgressBar: function() {
    var container = $$(".first_steps")[0];
    if (!container) { return; }
    container.select(".completion").invoke("remove");
    var percentage = Math.floor(this.steps.completed*100/this.steps.total);
    var html = Mustache.to_html(Templates.first_steps.progress_bar, {
      width: 100,
      filled: percentage,
      text: percentage+'%' });
    if (this.where == 'column') {
      container.down('h2').insert({ after: html });
    } else {
      container.insert({ top: html });
    }
  },
  hide: function() {
    if (!my_user.first_steps) { return; }
    $$(".first_steps").invoke('blindUp');
    my_user.first_steps = false;
    var save = new Ajax.Request("/account/first_steps/hide");
  }
};

document.on("dom:loaded", function() {
  FirstSteps.show();
});

document.on("click", ".first_steps .steps img", function(e,el) {
  var step_number = el.readAttribute("data-step");
  FirstSteps.chooseStep(step_number);
});

document.on("click", "a.close_first_steps", function(e,el) {
  e.stop();
  FirstSteps.hide();
});

document.on("badge:new_badge", function() {
  if ($$('.first_steps')[0]) { FirstSteps.show(); }
});
document.on('ajax:before', 'form', function(e, form) {
  if (form.hasClassName('required')) {
    form.select('.required').each(function(input) {
        if (input.value.strip().empty()) {
          e.stop();
          input.previous('label').toggleClassName('error');
          var error = input.next('span.error');
          if (error) {
            error.remove();
          }
          input.insert({after: '<span class=error>(' + input.getAttribute('error_message') + ')</span>'})
          input.highlight({duration: 1, color: 'red'});
        }
      });
  }
});

document.on('click', 'a.closeThis', function(e, link) {
  e.preventDefault()
  $(link.parentNode).hide()
})

document.on('submit', 'form', function(e, form) {
  var metaTagAuthToken = $$('meta[name=csrf-token]')[0].getAttribute('content'),
      authTokenInput = form.down('input[name=authenticity_token]');

  if (metaTagAuthToken && !metaTagAuthToken.blank() && authTokenInput) {
    authTokenInput.value = metaTagAuthToken;
  }
});
function writeLockConfirm(message) {
    Prototype.Facebox.open(message, 'html write_lock_box', {
        buttons: [
        {
            className: 'close',
            href:'#close',
            description: I18n.translations.common.close
            }
        ]
    })
}

document.on('click', '.google_docs_attachment a[rel="facebox"]', function(e, link){
  google_docs_originator = link.up('.google_docs_attachment')
})

document.on('ajax:success', '#google_docs #search_form form', function(e, form) {
  form.up('#google_docs').down('#google_docs_list').replace(e.memo.responseText)
})

document.on('change', '#google_docs input[type="checkbox"]', function(e, checkbox){
  if (checkbox.checked){
    addGoogleDocToForm(function(field_name){
      var data_field_name = 'data-' + field_name.gsub('_', '-')
      return checkbox.readAttribute('data-' + field_name.gsub('_', '-'))
    })
  }
  else {
    removeGoogleDocFromForm(checkbox.readAttribute('data-document-id'))
  }
})

document.on('ajax:success', '#google_docs #create_google_document_form form', function(e, form){
  var doc = e.memo.responseText.evalJSON(true)
  addGoogleDocToForm(function(field_name){
    return doc[field_name]
  })
  form.down('#google_doc_title').clear()
})

function removeGoogleDocFromForm(data_id){
  var selector = '[data-gform="' + data_id + '"]'
  google_docs_originator.getElementsBySelector(selector).each(function(element){
    element.remove()
  })
}

function addGoogleDocToForm(getFormValue){
  var form_area = google_docs_originator.down('.google_docs_attachment_form_area')
  var prefix = form_area.readAttribute('data-object-name')
  var previous_field = form_area.getElementsBySelector('input').last()

  var field_number = previous_field ? previous_field.readAttribute('name').findLastNumber() + 1 : 0

  var fields = ['document_id', 'title', 'url', 'document_type', 'edit_url', 'acl_url']
  fields.each(function(field_name){
    var newInput = new Element('input', {
      type: 'hidden',
      name: prefix + '[google_docs_attributes][' + field_number + '][' + field_name + ']',
      value: getFormValue(field_name),
      'data-gform': getFormValue('document_id')
    })

    form_area.down('.fields').insert(newInput)
  })

  var title = getFormValue('title')
  var doc_type = getFormValue('document_type')
  var url = getFormValue('url')
  var gid = getFormValue('document_id')
  var image = '<img src="/images/google_docs/icon_6_' + doc_type + '.gif" />'
  var image_span = '<span class="file_icon google_icon">' + image + '</span>'
  var link = '<span class="filename"><a href="' + url + '">' + title + '</a></span>'
  form_area.down('.file_list').insert('<li data-gform="' + gid  + '">' + image_span + link + '</li>')

}

String.prototype.findLastNumber = function(){
  var matches = this.match(/\d+/g)
  return parseInt(matches.last())
}

Hotkeys = {

  cache: {},
  special: { enter: 45, "?": 191, "/": 223, "\\": 252, "`": 224 },

  keys: function(options) {
    for(key in options) {
      Hotkeys.key(key, options[key])
    }
  },

  key: function(key, value) {
    c = Hotkeys.special[key] == null ? key.charCodeAt(0) : Hotkeys.special[key];
    Hotkeys.cache[c] = value
  }
}

document.on('dom:loaded', function() {
  $$('a[hotkey]').each(function (a) {
    Hotkeys.key(a.readAttribute('hotkey'), a.readAttribute('href'))
  })
})

document.on('keydown', function(e) {
  if (!my_user.keyboard_shortcuts) { return true }
  if (e.target.match(":input")){ return true }
  if (e.ctrlKey || e.altKey || e.metaKey) { return true }
  var dest = Hotkeys.cache[e.keyCode + 32]
  if (dest) {
    Object.isFunction(dest) ? dest.call(this) : window.location = dest
  }
})

var Hours = {
  initFromJSON: function(hours_data) {
    Hours.init(hours_data.start)
    Hours.addHours(hours_data.hours)
    Hours.userMap = hours_data.userMap
    Hours.userNameMap = hours_data.userNameMap
    Hours.taskMap = hours_data.taskMap
    Hours.projectMap = hours_data.projectMap
    Hours.organizationMap = hours_data.organizationMap
    Hours.update()
  },

  init: function(start_date) {
    this.hours = []
    this.start_date = start_date
    this.weekends = [0,6]

    this.userMap = {}
    this.taskMap = {}
    this.projectMap = {}
    this.organizationMap = {}
    this.showWeekends = false

    this.filters = {
      'user': null,
      'project': null,
      'organization': null
    }

    this.currentReport = 'user'

    document.on('change', '#hours_user_filter_assigned', Hours.userFilterHandler)
    document.on('change', '#hours_project_filter_assigned', Hours.projectFilterHandler)
    document.on('change', '#hours_organization_filter_assigned', Hours.organizationFilterHandler)


    this.setProjectFilter(0, true)
    this.setUserFilter(0, true)
    this.setOrganizationFilter(0, true)
  },

  clearAll: function(selector, enabled) {
    $$(selector).each(function(e){
      e.checked = false
      e.disabled = !enabled
    })
  },

  setOrganizationFilter: function(id, enabled) {
    if (id == 0)
      this.filters.organization = enabled ? null : []
    else
    {
      if (enabled)
        this.filters.organization.push(id)
      else
        this.filters.organization = Hours.filters.organization.without(id)
    }
  },


  setProjectFilter: function(id, enabled) {
    if (id == 0)
      this.filters.project = enabled ? null : []
    else
    {
      if (enabled)
        this.filters.project.push(id)
      else
        this.filters.project = Hours.filters.project.without(id)
    }
  },

  setUserFilter: function(id, enabled) {
    if (id == 0)
      Hours.filters.user = enabled ? null : []
    else
    {
      if (enabled)
        Hours.filters.user.push(id)
      else
        Hours.filters.user = Hours.filters.user.without(id)
    }
  },

  organizationFilterHandler: function(evt, el) {
    var value = el.getValue()

    Hours.setOrganizationFilter(0, false)
    Hours.setOrganizationFilter(parseInt(value), true)

    Hours.update()
    return true
  },

  projectFilterHandler: function(evt, el) {
    var value = el.getValue()

    Hours.setProjectFilter(0, false)
    Hours.setProjectFilter(parseInt(value), true)

    Hours.update()
    return true
  },

  userFilterHandler: function(evt, el) {
    var value = el.getValue()

    Hours.setUserFilter(0, false)
    Hours.setUserFilter(parseInt(value), true)

    Hours.update()
    return true
  },

  addHours: function(comments) {
    comments.each(function(comment){
      var record = {
        id: comment.id,
        date: new Date(comment.date[0], comment.date[1], comment.date[2],0,0,0,0),
        week: comment.week,
        organization_id: comment.organization_id,
        project_id: comment.project_id,
        user_id: comment.user_id,
        task_id: comment.task_id,
        hours: comment.hours
      }

      var d = record.date
      record.key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
      Hours.hours.push(record);
    })
  },

  setReport: function(report) {
    this.currentReport = report
    this.update()
  },

  update: function() {
    this['report_' + this.currentReport]()
  },

  insertCommentBlocks: function(comments, func){
    comments.keys().each(function(key){
      var v = comments.get(key)
      var date = v.date
      if (date) {
        var calBlock = $("day_" + (date.getMonth()+1) + "_" + date.getDate())
        func(v, v.list, calBlock)
      }
    })
  },

  clearCommentBlocks: function(){
    $$('p.hours').invoke("remove")
  },

  sumByHours: function(field, map) {
    var comments = this.getFilteredComments()
    var weekSum = [{},{},{},{},{},{}]
    var totalSum = {}
    var weekTotal = 0
    this.showWeekends = false

    $$('div.comment').invoke("hide")

    comments = this.reduceComments(comments, function(key, values){
      var item = {}
      if (values.length > 0)
        item.date = values[0].date
      else
        item.date = null

      var list = {}
      values.each(function(c){
        var id = c[field]
        var value = list[id]
        if (value == null || value == undefined)
          list[id] = c.hours
        else
          list[id] += c.hours

        $('comment_' + c.id).show()

        if (!Hours.showWeekends)
        {
          var day = c.date.getDay()
          if (day == 0 || day == 6)
            Hours.showWeekends = true
        }

        var week = Math.floor((c.date - Hours.start_date) / (86400000 * 7))
        var sum = weekSum[week][id]
        if (sum == null || sum == undefined)
          weekSum[week][id] = c.hours
        else
          weekSum[week][id] += c.hours

        sum = totalSum[id]
        if (sum == null || sum == undefined)
          totalSum[id] = c.hours
        else
          totalSum[id] += c.hours

        weekTotal += c.hours
      })

      item.list = $H(list)
      return item
    })

    this.clearCommentBlocks()

    for (var i=0; i<5; i++) {
      var values = weekSum[i]
      for (var key in values) {
        var code = "<p class=\"hours\">" + map[key] + '<br/>' + values[key].friendlyHours(2) + "</p>"
        $('week_' + i).insert({top:code})
      }
    }

    for (var key in totalSum) {
      var code = "<p class=\"hours\">" + map[key] + '<br/>' + totalSum[key].friendlyHours(2) + "</p>"
      $('hour_total').insert({top:code})
    }
    $('total_sum').innerHTML = weekTotal.friendlyHours()

    this.insertCommentBlocks(comments, function(v, list, block){
      list.keys().each(function(key){
        var code = "<p class=\"hours\">" +  map[key] + "<br/>" + list.get(key).friendlyHours(2) + " </p>"
        block.insert({bottom:code})
      })
    })

    if (this.showWeekends) {
      $$('.cal_wd' + this.weekends[0] + ', .cal_wd' + this.weekends[1]).each(function(e) {e.show();})
      $('calendar').removeClassName('calendar5')
    } else {
        $$('.cal_wd' + this.weekends[0] + ', .cal_wd' + this.weekends[1]).each(function(e) {e.hide();})
      $('calendar').addClassName('calendar5')
    }

    return comments
  },

  report_user: function(){
    return this.sumByHours('user_id', this.userMap)
  },

  report_task: function(){
    return this.sumByHours('task_id', this.taskMap)
  },

  report_project: function(){
    return this.sumByHours('project_id', this.projectMap)
  },

  getFilteredComments: function(){
    var projectFilters = this.filters.project
    var userFilters = this.filters.user
    var organizationFilters = this.filters.organization

    return this.mapComments(this.hours, function(c) {
      if (!Hours.applyFilter(c,
                          projectFilters,
                          userFilters,
                          organizationFilters))
        return null

      return {key:c.key, value:c}
    })
  },

  mapComments: function(comments, func){
    var set = {}
    comments.each(function(c){
      var res = func(c)
      if (res == null)
        return

      var key = res.key
      var value = res.value

      var sv = set[key]
      if (sv == null || sv == undefined)
        set[key] = [value]
      else
        sv.push(value)
    })

    return $H(set)
  },

  reduceComments: function(comments, func){
    var res = $H()
    comments.keys().each(function(key){
      var values = comments.get(key)
      res.set(key, func(key, values))
    })
    return res
  },

  applyFilter: function(hour, projectFilters, userFilters, organizationFilters){
    if (organizationFilters != null) {
      if (organizationFilters.indexOf(hour.organization_id) == -1)
        return false
    }

    if (projectFilters != null) {
      if (projectFilters.indexOf(hour.project_id) == -1)
        return false
    }

    if (userFilters != null) {
      if (userFilters.indexOf(hour.user_id) == -1)
        return false
    }

    return true
  }
}

Number.prototype.friendlyHours = function() {
  if (this <= 0)
    return 0
  var out = this.floor() + 'h', minutes = ((this % 1) * 60).round()
  if (minutes) out += ' ' + minutes + 'm'
  return out
}

document.on('change', '#report_list', function(e, el){
  Hours.currentReport = el.getValue()
  Hours.update()
})

document.on('navigation:loaded', '.nav_links a.time', function(e,el) {
    Hours.initFromJSON(HOURS_DATA)
    HOURS_DATA = null
})

document.on('dom:loaded', function(){
	if ($(document.body).hasClassName('index_hours')) {
	  Hours.initFromJSON(HOURS_DATA)
      HOURS_DATA = null
    }
})
document.on("mouseover", ".hoverable", function(e,el) {
  if (!el.up('.hoverbox')) {
    var hoverbox = new Element('div', { 'class': 'hoverbox' })
    hoverbox.addClassName(el.readAttribute('data-hoverable-class'))
    el.wrap(hoverbox)
    hoverbox.insert({ bottom: "<div class='arrow'></div>" })
    hoverbox.insert({ bottom: "<div class='panel'>"+el.readAttribute('title')+"</div>" })
    el.writeAttribute('title', null)
  }
})
document.on('ajax:success', 'a.invitation-destroy', function(e,link) {
	link.up('.invitation').fade()
})

document.on('click','#invitation_select_language', function(e) {
  e.element().replace($("all_locales").innerHTML)
  $('all_locales').remove()
})
Keyboard = {
  showHelp: function() {
    if (!$('keyboard_shortcuts').visible()) {
      Effect.Appear('keyboard_shortcuts', { duration: 0.4 })
      setTimeout(function() { Keyboard.hideHelp() }, 5000)
  }
  },
  hideHelp: function() {
    Effect.Fade('keyboard_shortcuts', { duration: 0.4 })
  }
}

document.on('dom:loaded', function() {
  Hotkeys.key('h', function() { Keyboard.showHelp()} )
})

var ToggleForm = {
	debug: false,

	toggleElement: function(el) {
		ToggleForm.toggle(parseInt(el.readAttribute('new_record')),
		             el.readAttribute('header_id'),
		             el.readAttribute('link_id'),
		             el.readAttribute('form_id'));
	},

	toggle: function(new_record, header_id, link_id, form_id) {
		var header = $(header_id);
		var link = $(link_id);
		var form = $(form_id);

		if (new_record) {
			if (link)
	        	link.toggle();
	        if (!form.visible())
		      Effect.BlindDown(form_id, { duration: .3 });
		    else
		      Effect.BlindUp(form_id, { duration: .3 });
		} else {
			var formVisible = form.visible();

	        if (!formVisible) {
		    	Effect.BlindDown(form_id, { duration: .3 });
				formVisible = true;
			} else {
		    	Effect.BlindUp(form_id, { duration: .3 });
				formVisible = false;
			}

			if (header)
			{
	        	if (!formVisible)
			    	Effect.BlindDown(header_id, { duration: .3 });
				else
		    		Effect.BlindUp(header_id, { duration: .3 });
			}
		}

		Form.reset(form_id);

		if (form.hasClassName('form_error'))
		{
			form.removeClassName('form_error');
		}

		$$('# ' + form_id + ' .error').each(function(e){e.remove();});

		if (form.getStyle('display') == 'block')
			form.focusFirstElement();

		var formClass = "";
		document.fire("toggleform:toggle:" + formClass, {form:form});
	},

	handleForm: function(form) {
		var url = form.readAttribute('action');
		var formClass = form.readAttribute('toggleformtype');

		if (ToggleForm.debug)
			console.log('TOGGLE:CB:' + formClass + ' -> ' + url);

	    new Ajax.Request(url, {
	      asynchronous: true,
	      evalScripts: true,
	      method: form.readAttribute('method'),
	      parameters: form.serialize(),
	      onLoading: function() {
		  	form.down('.submit').hide();
		  	form.down('img.loading').show();
			document.fire("toggleform:loading:" + formClass, {form:form});
	      },
	      onFailure: function(response) {
		  	form.down('.submit').show();
		  	form.down('img.loading').hide();
			document.fire("toggleform:failed:" + formClass, {form:form});
	      },
	      onSuccess: function(response){
			document.fire("toggleform:loaded:" + formClass, {form:form});
	      }
	   });
    },

    handleCancelForm: function(form) {
		var formClass = form.readAttribute('toggleformtype');
		ToggleForm.toggleElement(form);
		document.fire("toggleform:cancel:" + formClass, {form:form});
	}
};

document.on('submit', 'form.toggleform_form', function(e, el) {
  e.stop();
  ToggleForm.handleForm(el);
});

document.on('click', 'a.new_task_list_link', function(e, el) {
  e.stop();
  ToggleForm.toggleElement(el);
});

document.on('click', 'a.inline_form_create_cancel', function(e, el) {
  e.stop();
  ToggleForm.handleCancelForm(el.up('form')); // hide form
});

document.on('click', 'a.inline_form_update_cancel', function(e, el) {
  e.stop();
  ToggleForm.handleCancelForm(el.up('form')); // hide form
});

NavigationBar = {
  detectSelectedSection: function() {
		var link = $$('.nav_links a').select(function(e) {
			return e.getAttribute('href') == window.location.pathname
		}).last()
		if (link) link.up('.el').addClassName('selected')
		if (link == undefined) {
			var link = $$('.nav_links a').sortBy(function(e) {
				return e.getAttribute('href').length
				}).select(function(e) {
					return (window.location.pathname.search(e.getAttribute('href')) > -1 && e.getAttribute('href') != '/')
			}).last()
			if (link) link.up('.el').addClassName('children-selected')
		}

    if(link) return link.up('.el')
  },

  showContainers: function(current) {
    var container = current.up('.contained')
    if (container) {
      container.show().previous('.el').addClassName('expanded')
      while (container = container.up('.contained')) {
				container.show().previous('.el').addClassName('expanded')
			}
    }
  },

  scroll: function() {
    var sidebar = $('column')
    var column = sidebar.up('.column_wrap')
    if (document.viewport.getHeight() > sidebar.getHeight() && document.viewport.getScrollOffsets()[1] >= NavigationBar.initial_offset) {
      sidebar.style.position = 'fixed'
      sidebar.style.top = 0
    }
    else
    {
      sidebar.style.position = 'absolute'
      sidebar.style.top = 'auto'
      column.style.height=sidebar.getHeight()+'px'
    }

  },

  scrollToTopIfNeeded: function() {
    var sidebar = $('column')
    if (document.viewport.getHeight() < sidebar.getHeight()) {
      NavigationBar.scroll()
      Effect.ScrollTo('container', { duration: '0.4' })
    }
  },

  toggleElement: function(el, effect) {
    var contained = el.next()
    if (contained && contained.hasClassName('contained')) {
      if (el.hasClassName('expanded')) {
        el.removeClassName('expanded')
        contained.setStyle({height: ''})
        contained.blindUp({ duration: 0.2 })
      } else {
        var visible_containers = el.up().select('.contained').select( function(e) { return e.visible() })
        effect ? visible_containers.invoke("blindUp", { duration: 0.2 }) : visible_containers.invoke('hide')
        el.up().select('.el').invoke('removeClassName', 'expanded')
        el.addClassName('expanded')

        contained.setStyle({height: ''})
        effect ? contained.blindDown({ duration: 0.2 }) : contained.show()
        setTimeout(function() { NavigationBar.scrollToTopIfNeeded() }, 100)
      }
      return true
    }
    return el.hasClassName('selected')
  },

  selectElement: function(el) {
    $$('.nav_links .el.selected').invoke('removeClassName', 'selected').invoke('removeClassName', 'children-selected')
    el.addClassName('selected')
  },

  loadProjectsSidebar: function() {
    var active_projects = $H(my_projects).select(function(p) { return !p[1].archived; });
    var projects_to_show = active_projects;
    var show_more = ($H(my_projects).size() > 0);
    if (projects_to_show.size() > 3) {
      projects_to_show = projects_to_show.select(function(p) { return my_user.recent_projects.include(p[0]); })
    }
    var projects = projects_to_show.collect(function(p) {
      return { name: p[1].name
             , permalink: p[1].permalink
             , time_tracking: p[1].time_tracking
             , owner: (p[1].owner == my_user.id) // Owner?
             , can_admin: (p[1].role == "3") // Admin?
      };
    })
    $('my_projects').down('span').update(active_projects.size());
    $('my_projects_list').update(Mustache.to_html(Templates.navigation.project, { projects: projects, show_more: show_more, new_project: my_user.can_create_project }));
  },

  loadOrganizationsSidebar: function() {
    var organizations = my_organizations.collect(function(o) {
      return { name: o.name , permalink: o.permalink, can_admin: (o.role == 30) };
    });
    $('my_organizations_list').update(Mustache.to_html(Templates.navigation.organizations, {
      organizations: organizations, no_community: !my_user.community
    }));
  }
}

document.on("dom:loaded", function() {
  NavigationBar.loadProjectsSidebar()
  NavigationBar.loadOrganizationsSidebar()
  $$('.nav_links .contained').invoke('hide')
  var column = window.$('column')
  if (!column)
    return

  column.style.position='absolute'
  NavigationBar.initial_offset = document.viewport.getScrollOffsets()[1] + column.viewportOffset().top

  var current = NavigationBar.detectSelectedSection()
  if (current) {
    NavigationBar.toggleElement(current)
    NavigationBar.showContainers(current)
  }
  var elements = $$('.nav_links .el')
  if (elements[0] && elements[0].hasClassName('selected')) {
    NavigationBar.toggleElement(elements[1])
  }
})

document.on('click', '.nav_links .el', function(e,el) {
  if (e.isMiddleClick()) return
  var clicked = Event.element(e)
  if (clicked.id == 'open_my_tasks') {
    window.location = clicked.readAttribute("href")
    e.stop()
  } else {
    NavigationBar.toggleElement(el, true) && e.stop()
  }
})

document.on('click', '.nav_links .el#show_all_projects', function(e,el) {
  if (e.isMiddleClick()) return
  e.stop()
  Projects.showAllProjects()
})

window.onscroll = function() { NavigationBar.scroll() }


extractParts = function(responseText) {
  if (!$('_extractor')) $(document.body).insert({ bottom: "<div id='_extractor' style='display:none'></div>" })
  var extractor = $('_extractor')
  extractor.insert({ top: responseText })
  var response = {
    body_classes: extractor.down(".body_classes").innerHTML,
    content: extractor.down(".content_part"),
    column: extractor.down(".column_part")
  }
  return response
}

postNavLinkCallback = function(el) {
	el.fire('navigation:loaded')
}

document.on('click', '.nav_links a.ajax', function(e,a) {
  if (e.isMiddleClick()) return
  e.stop()
  $$('.nav_links a').invoke('removeClassName', 'loading')
  new Ajax.Request(a.readAttribute('href')+"?extractparts=1", {
    method: "get",
    onLoading: function(r) { a.addClassName('loading') },
    onComplete: function(r) { a.removeClassName('loading') },
    onSuccess: function(r) {
      var parts = extractParts(r.responseText)
      if (!parts.content)
        return this.onFailure(r);

      NavigationBar.selectElement(a.up('.el'))

      document.body.className = parts.body_classes
      $('content').update(parts.content)
      $$('.view_sidebar').first().update(parts.column)
      Date.format_posted_dates()
      Task.insertAssignableUsers()
      disableConversationHttpMethodField()
      Pane.clear()

      pushHistoryState(a.readAttribute('href'))
      postNavLinkCallback.delay(0.1, a)
    },
    onFailure: function(r) {
      document.location = a.readAttribute('href')
    }
  })
})
document.on('ajax:success', ".thread[data-class='task'] form", function(e, form) {
  var status = form.down("select[name='task[status]']").getValue();
  var person = form.down("select[name='task[assigned_id]']").getValue();

  var is_assigned_to_me = (status == 1) && my_projects[person];
  var task = $('my_task_'+form.up('.thread').readAttribute('data-id'));

  if(task) {
    is_assigned_to_me ? task.show() : task.hide()
  }
})
Overlays = {
  open_overlays: [],
  open: function(el, overlay) {
    this.closeAll();
    el.insert({ bottom: overlay });
    this.open_overlays.push(el.down('.overlay'));
  },
  closeAll: function() {
    this.open_overlays.invoke('remove');
    this.open_overlays = [];
  }
};


document.on("click", ".project_overlay a", function(e,el) {
  var project = my_projects[el.readAttribute('data-project-id')];
  if (project) {
    e.stop();
    Overlays.open(
      el.up('.project_overlay'),
      Mustache.to_html(Templates.projects.overlay, { project: project }));
  }
});

document.on("click", function(e,el) {
  if (el.up('.project_overlay')) { return; }
  Overlays.closeAll();
});
Element.addMethods({
  getSlotId: function(element) {
    element = $(element)
    return element.readAttribute('slot') ||
      (element.id && element.id.match(/^page_slot_(\d+)$/) && RegExp.$1)
  }
})

var Page = {
  SLOT_VERGE_BEFORE: 3,
  SLOT_VERGE_AFTER: 6,
  READONLY: false,

  init: function(readonly, url) {
    this.READONLY = readonly;
    this.url = url;
    document.currentPage = this;
    if (!readonly) {
      InsertHere.init();
      InsertionBar.init();
      InsertHere.set(null, true);

      $($('content').parentNode).observe('mousemove', InsertHereFunc);
    }
  },

  makeSortable: function() {
    if (this.READONLY)
      return;

    Sortable.create('slots', {handle: 'slot_handle', tag: 'div', only: 'page_slot',
      onUpdate: function() {
        var csrf_param = $$('meta[name=csrf-param]').first(),
            csrf_token = $$('meta[name=csrf-token]').first(),
            serialized = Sortable.serialize('slots', {name: 'slots'});

        if (csrf_param) {
          var param = csrf_param.readAttribute('content'),
              token = csrf_token.readAttribute('content')

          serialized += '&' + param + '=' + token
        }

        new Ajax.Request(Page.url + '/reorder', { parameters: serialized });
      }
    });
  },

  insertWidget: function(widget_id, pos, element_id, content) {
    var el = $(element_id);
    var opts = {};
    if (!el) {
      el = $('slots');
      if (pos == 'before')
        opts['top'] = content;
      else if (pos == 'after')
        opts['bottom'] = content;
      else
        opts[pos] = content; // 0_0;
    } else {
      opts[pos] = content;
    }

    el.insert(opts);
    new Effect.Highlight(widget_id, {duration:3});
  }
}

var InsertionBar = {
  element: null,
  element_bar: null,
  element_form: null,

  init: function() {
    this.element = $('pageInsertItems');
    this.element_bar  = $('pageInsertItemsBar');
    this.current_form = null;
  },

  show: function() {
    this.place();
    this.element_bar.blindDown({duration: 0.3});
  },

  place: function() {
    InsertHere.element.insert({before: this.element});
  },

  hide: function() {
    this.element_bar.hide();
  },

  revealForm: function() {
    this.element_bar.hide();
    this.current_form.show();

    InsertHere.enabled = true;
  },

  setWidgetForm: function(form) {
    this.clearWidgetForm();
    form = $(form);

    form.down('input[name="position[before]"]').setValue(Page.insert_before ? '1' : '0')
    form.down('input[name="position[slot]"]').setValue(Page.insert_element ? Page.insert_element.getSlotId() : '-1')
    this.current_form = form;
    this.revealForm();
  },

  setWidgetFormLoading: function(id, active) {
    var form = $(id);
    var submit = form ? form.down('.submit') : null;
    var loading = form ? form.down('.loading') : null;

    if (!(submit && loading)) return;

    if (active) {
      submit.hide();
      loading.show();
    } else {
      submit.show();
      loading.hide();
    }
  },

  clearWidgetForm: function() {
    if (this.current_form) {
      this.current_form.reset();
      this.current_form.hide();
	  this.current_form.fire('ajax:complete');
      this.current_form = null;
    }
  }
};

var InsertHere = {
  element: null,
  enabled: false,
  visible: false,

  init: function() {
    this.element = $('pageInsert');
    this.enabled = true;
    this.visible = false;
    Page.insert_element = null;
  },

  show: function(el, insert_before) {
    this.visible = true;
    this.set(el, insert_before);
    this.element.show();
    this.updateSlot(true);
  },

  hide: function() {
    if (this.visible) {
      this.element.hide();
      this.visible = false;
      this.updateSlot(false);
      if (this.enabled)
        this.set(null, true);
    }
  },

  updateSlot: function(active) {
    if (Page.insert_element == null)
      return;
    var el = Page.insert_before ? Page.insert_element : Page.next_element;
    if (el == null)
      return;
    if (active) {
      el.addClassName("InsertBefore");
    } else {
      el.removeClassName("InsertBefore");
    }
  },

  nextSlot: function() {
    if (Page.insert_element == null)
      return;
    var next = Page.insert_element.next();
    while (next != null && !next.getSlotId()) {
      next = next.next();
    }
    return next;
  },

  set: function(element, insert_before) {
    var el = element == null ? $(Element.getElementsBySelector($('slots'), '.page_slot')[0]) : element;

    this.updateSlot(false);
    Page.insert_element = el;
    Page.next_element = this.nextSlot();
    Page.insert_before = el ? insert_before : true;
    if (this.visible)
      this.updateSlot(true);

    if (el == null)
      $('slots').insert({bottom: this.element});
    else if (insert_before)
      el.insert({before: this.element});
    else
      el.insert({after: this.element});
  }
};

var InsertHereFunc = function(evt){
  if (!InsertHere.enabled)
    return;

  var el = $(evt.target);
  if (el.readAttribute('id') == "PIB")
    return;
  var slot = el.hasClassName('page_slot') ? el : el.up('div.page_slot');
  if (!slot)
    return;

  var pt = evt.pointer(),
      offset = slot.cumulativeOffset(),
      delta = pt.x - offset.left,
      w = slot.getDimensions().width;

  if (delta < (w-32)) {
    var h = slot.getHeight(),
        thr_b = Math.min(h / 2, Page.SLOT_VERGE_BEFORE), thr_a = Math.min(h / 2, Page.SLOT_VERGE_AFTER);
    if (slot.hasClassName('pageFooter')) // before footer
      InsertHere.show(slot, true);
    else if (pt.y - offset.top <= thr_b) // before element
      InsertHere.show(slot, true);
    else if ((offset.top + h) - pt.y <= thr_a) // after element
      InsertHere.show(slot, false);
    else
      InsertHere.hide();
  } else {
    InsertHere.hide();
  }
}

document.on('dom:loaded', function() {
  if ($$('body.show_pages').first()) {
    Page.init($('slots').hasClassName('readonly'), window.location.pathname);
    Page.makeSortable();
  }
})


document.on('click', 'a.note_button, a.divider_button, a.upload_button', function(e, button) {
  e.preventDefault();

  if (!button.up('.pageSlots')) {
    InsertHere.set(null, true);
    InsertionBar.place();
  }

  var type = button.className.match(/\b(note|divider|upload)_/)[1];

  var form = $('new_' + type);
  InsertionBar.setWidgetFormLoading(form, false);
  Form.reset(form);
  InsertionBar.setWidgetForm(form);
  form.focusFirstElement();
});

document.on('click', 'a.cancelPageWidget', function(e) {
  e.stop()
  InsertionBar.clearWidgetForm();
});

document.on('click', '#page_reorder', function(e) {
  e.stop();
  $('page_reorder').hide();
  $('page_reorder_done').show();

  Sortable.create('column_pages', {handle: 'drag', tag: 'div', only: 'page',
    onUpdate: function() {
      var csrf_param = $$('meta[name=csrf-param]').first(),
          csrf_token = $$('meta[name=csrf-token]').first(),
          serialized = Sortable.serialize('column_pages', {name: 'pages'});

      if (csrf_param) {
        var param = csrf_param.readAttribute('content'),
            token = csrf_token.readAttribute('content')

        serialized += '&' + param + '=' + token
      }

      new Ajax.Request($('column_pages').readAttribute('reorder_url'), { parameters: serialized });
    }
  });

  $('column_pages').addClassName('reordering');
});

document.on('click', '#page_reorder_done', function(e) {
  e.stop();

  $('column_pages').removeClassName('reordering');
  $('page_reorder').show();
  $('page_reorder_done').hide();

  Sortable.destroy('column_pages');
});

document.on('click', '.pageForm a.cancel', function(e, el){
  e.stop();
  el.up('.pageForm').remove();
});

document.on('click', '#pageInsert', function(e, el){
  if (InsertionBar.current_form) {
    InsertionBar.place();
  } else {
    InsertionBar.show();
    InsertHere.enabled = false;
    InsertHere.hide();
  }
});

document.on('click', 'div.page_slot', function(e, el){
  if (!InsertHere.visible)
    return;
  if (InsertionBar.current_form) {
    InsertionBar.place();
  } else {
    InsertionBar.show();
    InsertHere.enabled = false;
    InsertHere.hide();
  }
});

document.on('click', '#pageInsertItemCancel', function(e, el) {
  e.stop();
  InsertionBar.hide();
  InsertHere.enabled = true;
});


document.on('ajax:before', '.page_slot .actions, .page_slot .slotActions', function(e) {
  e.findElement('a').hide().next('.loading_action').show();
});

document.on('ajax:complete', '.page_slot .actions, .page_slot .slotActions', function(e) {
  e.findElement('a').show().next('.loading_action').hide();
});

document.on('ajax:before', '.page_slot .note form, .page_slot .divider form', function(e, el) {
  el.down('.submit').hide();
  el.down('img.loading').show();
});

document.on('ajax:complete', '.page_slot .note form, .page_slot .divider form', function(e, el) {
  el.down('.submit').show();
  el.down('img.loading').hide();
});

document.on('ajax:create', 'form.edit_note', function(e, element) {
  element.down('img.loading').show()
});

document.on('submit', 'body.show_pages form#new_upload', function(e, form) {
  var iframe = new Element('iframe', { id: 'file_upload_iframe', name: 'file_upload_iframe' }).hide()
  $(document.body).insert(iframe)
  form.target = iframe.id
  form.insert(new Element('input', { type: 'hidden', name: 'iframe', value: 'true' }))
})
document.on('scroll', function() {
  var link = $$('.show_more_button a.activity_paginate_link').last();
  if(!link) return;

  var view_height = document.viewport.getHeight();
  var link_height = link.viewportOffset().top;
  var refresh_fn = link.onclick;
  if (!refresh_fn) return; // RAILS3 fix this

  if( (link_height < view_height - 350) && !refresh_fn.called) {
    refresh_fn.called = true;
    refresh_fn();
  }
})

document.on('ajax:create', '.activity_paginate_link', function(e, form) {
  $('activity_paginate_link').hide()
  $('activity_paginate_loading').show()
})

Pane = {
  save: function() {
    Pane.previousContent = $('content').innerHTML;
    $('content').innerHTML = "";
  },
  clear: function() {
    Pane.previousContent = undefined;
    Pane.previousURL = undefined;
  },
  replace: function(content, url) {
    $('content').update(content);
    if (url) {
      Pane.previousURL = window.location.pathname;
      pushHistoryState(url);
    }
  },
  saveAndReplace: function(content) {
    Pane.save();
    Pane.replace(content);
  },
  retrieve: function() {
    if(Pane.previousContent) {
      $('content').update(Pane.previousContent);
      if(Pane.previousURL) {
        pushHistoryState(Pane.previousURL);
      }
      Pane.clear();
    }
  }
};


document.on('click', 'a.closePane', function(e, el) {
  e.preventDefault();
  Pane.retrieve();
});

function params(name)
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return null;
  else
    return results[1];
}
hideBySelector('#people .edit_person')

document.on('click', '#people a[href="#edit"]', function(e, link) {
  e.preventDefault()
  var parent = link.up('.person')
  parent.down('.edit_person').forceShow()
  parent.down('.person_header').hide()
})

document.on('click', '#people form a[href="#cancel"]', function(e, link) {
  e.preventDefault()
  var parent = link.up('.person')
  parent.down('.edit_person').hide()
  parent.down('.person_header').show()
})

document.on('ajax:success', '#people form', function(e, form) {
  form.up('.person').replace(e.memo.responseText)
})

document.on('change', '#other_projects select', function(e, selectbox) {
  var value = selectbox.getValue(), loading = $('people_project_load')
  if (value) {
    selectbox.up('form').request({
      onComplete: function(e) {
        loading.hide()
        $('sidebar_people').update(e.responseText)
      }
    })
    loading.show()
  } else {
    $('sidebar_people').update('')
    loading.hide()
  }
})

document.on('click', '#sidebar_people a[href]', function(e, link) {
  e.preventDefault()
  var login = link.readAttribute('href').split('/').last()
  $('invitation_user_or_email').setValue(login).focus()
})

document.on('ajax:success', '.person a[data-method="delete"]', function(e, link) {
  var parent = link.up('.person')
  parent.remove()
})
var Preview = {
  IMAGE_MATCH: /(^https?:\/\/[^\s]+\.(?:gif|png|jpeg|jpg)(\?)*(\d+)*$)/gim,
  init: function (textarea) {
    var box = new Element('div', { 'class': 'preview previewBox textilized invisible' })
    textarea.insert({ after: box })

    var formatter = new Showdown.converter;
    formatter.makeHtml = formatter.makeHtml.wrap(function(make) {
      var value = textarea.getValue()
      value = Preview.format_image(value)
      box.update(make(value))
    })

    textarea.on('keyup', formatter.makeHtml.bind(formatter).throttle(300))
    formatter.makeHtml()
    return box
  },
  format_image: function(text) {
     return text.replace(Preview.IMAGE_MATCH,
                         "<img class=\"comment-image\" src=\"$1\" frameborder=\"0\"/>")
  },
  toggle: function(box, button) {
    box.toggleClassName('invisible');
    if (button) {
      var text = button.innerHTML;
      button.update(button.readAttribute('data-alternate')).writeAttribute('data-alternate', text);
    }
  }
}

document.on('click', 'form button.preview', function(e, button) {
  e.stop()

  var form = e.findElement('form'),
      textarea = form.down('textarea'),
      box = form.down('div.preview')

  if (!box) box = Preview.init(textarea)

  Preview.toggle(box, button)
  Preview.manualPreview = true
})

document.on('ajax:success', 'form, div.preview', function(e, form) {
  var box = form.down('div.preview')
  if (box) box.remove()
})

document.on('keyup', 'form textarea', function(e, area) {
  if (Preview.manualPreview) return
  if (e.keyCode == Event.KEY_RETURN) {
    var form = area.up('form'),
        textarea = form.down('textarea'),
        box = form.down('div.preview'),
        button = form.down('button.preview')

    if (!box) box = Preview.init(textarea)
    if (box.hasClassName('invisible')) {
      Preview.toggle(box, button)
    }
  }
})
PrivateBox = {

  findUser: function(project_id, user_id) {
    var people = _people[project_id];
    var len = people.length;
    for (var i=0; i<len; i++) {
      var p = people[i];
      if (p[3] == user_id)
        return p;
    }
    return null;
  },

  allUsersEnabled: function(private_users) {
	var count = 0
    var users = private_users.select('.private_user input')
    users.each(function(fe){ if (fe.checked) count += 1 })
    return count == users.length
  },

  updateAllUsersEnabled: function(users) {
    users.down('.private_all input').checked = PrivateBox.allUsersEnabled(users)
  },

  redrawBox: function(form, project_id) {
    var box = form.down('.private_options');
    box.select('.private_users').invoke('remove');
    box.select('.readonly_warning').invoke('remove');

    var thread = box.up('.thread')
    var watcher_ids = null;
    var is_private = false;
    var creator_id = null;
    var assigned_id = null;
    if (thread) {
      watcher_ids = (thread.readAttribute('data-watcher-ids')||'').split(',');
      is_private = thread.hasClassName('private');
      creator_id = thread.readAttribute('data-creator-user-id');
      assigned_id = thread.readAttribute('data-assigned-id');
    }

    var watchers = form.down('.watchers'); // see new conversation form
    var private_input = box.down('.option.private input');
    var public_input = box.down('.option.normal input');
    if (private_input && private_input.checked) {
      box.insert({ bottom: this.peopleHTML(box.readAttribute('object-prefix'),
                                           box.readAttribute('object-type'),
                                           project_id, watcher_ids, assigned_id) });
      if (watchers) {
        watchers.select('input').invoke('disable');
        watchers.hide();
      }
      PrivateBox.updateAllUsersEnabled(box.down('.private_users'));
    } else if (private_input && watchers) {
      watchers.select('input').invoke('enable');
      watchers.show();
    } else if (!private_input && is_private) {
      box.insert({ bottom: this.peopleShowHTML(box.readAttribute('object-prefix'),
                                           box.readAttribute('object-type'),
                                           project_id, watcher_ids) });
      var creator = PrivateBox.findUser(project_id, creator_id);
      if (creator)
        box.insert({ bottom: '<p class="readonly_warning">' +
                             I18n.t(I18n.translations.comments['private']['readonly_warning'], {user: '<a href="/users/'+creator_id+'">'+creator[2]+'</a>'}) +
                             '</p>'})
    }
  },

  update: function(el) {
    var form = el.up('form');
    var select = $$('select#project_id');
    var project_id = form.readAttribute('data-project-id') || select[0].select('option').find(function(ele){return !!ele.selected;}).value;

    var private_option = form.down('.option.private input');
    if (private_option) {
      var text = _people[project_id].length == 1 ? I18n.translations.comments['private']['private_foreveralone'] : I18n.translations.comments['private']['private'];
	  form.down('.option.private label').update(text);
    }

    PrivateBox.redrawBox(form, project_id);
  },

  peopleHTML: function(object_id, object_type, project_id, watcher_ids, assigned_id) {
    var people = _people[project_id];
    var html = "";
    html = "<div class='private_users'>";
    html += '<div class="private_all"><input id="'+object_id +'_private_all" name="'+object_type+'[all_private]" type="checkbox" value="true"/><label for="'+object_id +'_private_all">'+ I18n.translations.comments['private']['all'] +'</label></div>';
    html += people.collect(function(p) {
      if (p[3] == my_user.id || p[0] == assigned_id) return '<input type="hidden" name="'+object_type+'[private_ids][]" type="checkbox" value="'+p[3]+'"/>';
      var ident = object_id +'_private_'+ p[3];
      var is_checked = (watcher_ids == null || watcher_ids.indexOf(p[3]) >= 0) ? 'checked="checked"' : '';
      return '<div class="private_user"><input '+is_checked+' name="'+object_type+'[private_ids][]" type="checkbox" value="'+p[3]+'" id="'+ ident + '"/><label for="' + ident + '">'+p[2]+'</label></div>';
    }).compact().join("");
    html += "</div>";
    return html;
  },

  peopleShowHTML: function(object_id, object_type, project_id, watcher_ids) {
    var people = _people[project_id];
    var html = "";
    html = "<div class='private_users'>";
    html += people.collect(function(p) {
      var is_checked = (watcher_ids == null || watcher_ids.indexOf(p[3]) >= 0) ? 'checked="checked"' : '';
      if (!is_checked)
        return '';
      else
        return '<div class="private_user"><label>'+p[2]+'</label></div>';
    }).compact().join("");
    html += "</div>";
    return html;
  },

  activate: function(form, thread, can_modify){
    var box = form.down('.private_options');
    var can_modify = thread ? thread.readAttribute('data-creator-user-id') == my_user.id : true;
    var private_set = thread ? thread.hasClassName('private') : false

    if (can_modify) {
      box.insert({bottom: Mustache.to_html(Templates.comments.private_box, {
        object_prefix: box.readAttribute('object-prefix'),
        object_type: box.readAttribute('object-type'),
        is_public: I18n.translations.comments['private']['public'],
        is_private: I18n.translations.comments['private']['private']
      })});

      if (private_set)
        box.down('.option.private input').checked = true;
      else
        box.down('.option.normal input').checked = true;
    } else {
      box.insert({bottom: Mustache.to_html(Templates.comments.private_box_readonly, {
        is_public: I18n.translations.comments['private']['public'],
        is_private: I18n.translations.comments['private']['private_global']
      })});

      if (private_set)
        box.down('.option.normal').hide();
      else
        box.down('.option.private').hide();
    }
  }

};

document.on("click", "a.private_switch", function(e,el) {
  e.stop();

  if (el.readAttribute('form-present') != '1') {
    var form = el.up('form')
    var extra = form.down('.extra')
    var thread = form.up('.thread')
    PrivateBox.activate(form, thread)
    el.writeAttribute('form-present', '1')
  }

  var options = el.up('form').down('.private_options')
  if (options.visible()) {
    options.select('input').invoke('disable');
  } else {
    options.select('input').invoke('enable');
  }

  PrivateBox.update(el);

  if (options.visible()) {
    options.hide();
  } else {
    options.show();
  }
});

document.on("change", ".private_options .option.normal input", function(e,el) {
  PrivateBox.update(el);
});

document.on("change", ".private_users .private_all input", function(e,el) {
  el.up('.private_users').select('.private_user input').each(function(fe){ fe.checked = el.checked; })
});

document.on("change", ".private_users .private_user input", function(e,el) {
  var users = el.up('.private_users')
  users.down('.private_all input').checked = PrivateBox.allUsersEnabled(users)
});

document.on("change", ".private_options .option.private input", function(e,el) {
  PrivateBox.update(el);
});

document.on("change", "select#project_id", function(e,el) {
  PrivateBox.update(el);
});

document.on("dom:loaded", function (e,el) {
  if (el.body.hasClassName('edit_pages') || el.body.hasClassName('new_pages')) {
	var form = $(el.body).down('.content').down('form')
    PrivateBox.activate(form, form)
    PrivateBox.update(form.down('div'))
    form.down('.private_options').select('input').invoke('enable');
  }
})
Projects = {
  organizationsWithProjects: function() {
    var projects = [];
    for(var i in my_projects) {
      if(!isNaN(i) && my_projects[i]) {
        var p = my_projects[i];
        p.id = parseInt(i);
        p.my_role = Projects.roles[p.role];
        p.admin = p.role == 3;
        projects.push(p);
      }
    }
    return my_external_organizations.collect(function(org) {
      org.projects = projects.
        select(function(p) {
          return p.organization_id == org.id; }).
        sortBy(function(p) {
          return p.name.toLowerCase(); });
      org.active_projects = org.projects.
        reject(function(p) {
          return p.archived; });
      org.archived_projects = org.projects.
        select(function(p) {
          return p.archived; });
      org.has_archived_projects =
        (org.archived_projects.length > 0) ?
        { count: org.archived_projects.length,
          name: org.name,
          projects: org.archived_projects } :
        false;
      return org;
    }).compact();
  },
  showAllProjects: function() {
    var html = Mustache.to_html(Templates.projects.index, {
      organizations: Projects.organizationsWithProjects()
    });
    Pane.replace(html);
  },
  roles: [
    I18n.translations.roles.observer,
    I18n.translations.roles.commenter,
    I18n.translations.roles.participant,
    I18n.translations.roles.admin
  ],
  fastCommentForm: function() {
    if (!$('project_id')) {
      return;
    }
    var projects_in_orgs = {};
    (new Hash(my_projects)).each(function(p) {
      var org_id = p[1].organization_id;
      if (projects_in_orgs[org_id]) {
        projects_in_orgs[org_id].push([p[0], p[1].name]);
      }
      else {
        projects_in_orgs[org_id] = [[p[0], p[1].name]];
      }
    });
    var groups = [];
    my_external_organizations.each(function(o) {
      var group = new Element('optgroup', { label: o.name });
      projects_in_orgs[o.id].sortBy(function(p) {return p[1]}).collect(function(p) {return p[0]}).each(function(p) {
        if (!my_projects[p].archived && (my_projects[p].role > 0)) {
          var project = new Element('option', { value: p }).insert(my_projects[p].name);
          group.insert(project);
        }
      });
      groups.push(group);
      $('project_id').insert(group);
    });

  }
}

document.on('click', 'a.show_archived', function(e,el) {
  e.stop()
  el.hide()
  el.up().next('.archived_projects').appear({duration: 0.2})
})

document.on('click', 'a.delete_project', function(e, el){
	e.preventDefault()
	Prototype.Facebox.open($('delete_project_html').innerHTML, 'html delete_project_box', {
		buttons: [
			{className: 'close', href:'#close', description: I18n.translations.common.cancel},
			{className: 'confirm', href:el.readAttribute('href'), description: I18n.translations.projects.fields.delete_this_project,
			 extra:"data-method='delete'"}
		]
	})
})

document.on('click', '#new_project_suggestions .box', function(e,el) {
  e.stop();
  var link = el.down('a');
  document.location = link.readAttribute('href');
});

document.on("dom:loaded", function () {
  Projects.fastCommentForm();
})

Search = {
  shouldDisplayResults: function(r) {
    return (r.request.url == Search.lastQuerySent) &&
           $('content').hasClassName('search_results');
  },
  getResults: function(query, force, page) {
    if(query.length == 0) {
      Search.lastQueryTyped = null;
      Search.lastQuerySent = null;
      Pane.retrieve();
      return;
    }
    if(query.length < 3 && !force) { return; }

    if (Search.lastQueryTyped == query) { return; }
    Search.lastQueryTyped = query;

    var url = "/api/1/search/?q="+escape(query) + (page ? '&page=' + page : '');
    Search.fetch(url, query, page);
  },
  fetch: function(url, query, page) {
    new Ajax.Request(url, {
      method: "get",
      onLoading: function(r) {
        if(!Search.lastQuerySent) { Pane.save(); }
        Search.lastQuerySent = r.request.url;
        Pane.replace(
          Mustache.to_html(Templates.search.loading, { query: query }),
          "/search/?q="+escape(query) + (page ? '&page=' + page : '')
        );
        $('content').addClassName('search_results');
        $('content').down('.pagination_links').hide();
      },
      onComplete: function(r) {
        if(!Search.shouldDisplayResults(r)) { return; }
        $('content').down('.loading').remove();
      },
      onSuccess: function(r) {
        if(!Search.shouldDisplayResults(r)) { return; }
        response = JSON.parse(r.responseText);
        Search.displayResults(response, query);
        if (response.total_pages > 1) {
          $('content').down('.pagination_links').show();
        }
      },
      onFailure: function(r) {
        if(!Search.shouldDisplayResults(r)) { return; }
        $('search_result').update('<p>An error occurred, please try reloading the page.</p>');
      }
    });
  },
  displayResults: function(response, query) {
    response.objects.each(function(r) {
      r.icon_class = Search.icons[r.type];
      r.project = response.references.detect(function(p) {
        return p.type == "Project" && p.id == r.project_id;
      });
      r.link = "/projects/"+r.project.permalink+"/"+r.type.underscore()+"s/"+r.id;
      r.timeago = Date.parseFormattedString(r.updated_at).timeAgo();
      r.name = (r.name || r.first_comment.body_html.stripTags()).truncate(65);
    });
    response.length = response.total_entries;

    /*
    * Create list of pagination links
    */
    function pagination() {
      var links = new Array(response.total_pages);

      /*
      * Calculate page ranges
      */
      function entry_info(page, per_page, total_entries, total_pages) {
        var offset = page > 1 ? ((page - 1)* per_page + (page - 1)) : 1
        , diff = ((page * per_page) - total_entries)
        , length = diff > 0 ? total_entries : (offset + per_page);

        var info = "#{start}-#{finish}".interpolate({start: offset, finish: page > 1 ? length : (length - 1)});

        if (response.total_pages < 2) {
          if (reponse.length.length < 2) { return ""; }
          else {
            return info;
          }
        }
        else {
          return info;
        }
      };

      for (var i = 0; i < response.total_pages; i++) {
        var url = "/api/1/search/?q="+escape(query) + '&page=' + (i + 1)
        , entry = new Element('li', {})
        , info = entry_info(i + 1
                            , response.per_page
                            , response.total_entries
                            , response.total_pages
                           );

        if (response.current_page !== (i + 1)) {
          entry.insert({bottom: new Element('a', {
                                 href: url
                                 , className: 'page'
                                 , "data-attribute-query": query
                                 , "data-attribute-page": (i+1)
                                })
               .update(info)});
        }
        else {
          entry.insert({bottom: new Element('span').update(info)});
        }

        links.push(entry);
      };
      return links;
    };

    var results = $('search_results').update(
      Mustache.to_html(Templates.search.results, response)
    );
    var pages = pagination();
    pages.each(function(li) {
      results.next('.pagination_links').down('.pages').insert({bottom: li});
    });
  },
  icons: {
    "Conversation": 'comment_icon',
    "TaskList": 'task_icon',
    "Task": 'task_icon',
    "Page": 'page_icon'
  }
};

document.on('keydown', 'input#searchbox', function(e,el) {
  if (e.keyCode == Event.KEY_RETURN) {
    e.stop();
    Search.getResults($('searchbox').value, true);
  }
});

document.on('keydown', 'input#searchbox', function(e,el) {
  Search.getResults($('searchbox').value);
}.debounce(800)); // we only query once every 800 ms at most

document.on('click', 'input#searchbox', function(e,el) {
  Search.getResults($('searchbox').value);
});

document.on('click', 'a.closePane', function(e, el) {
  e.preventDefault();
  Pane.retrieve();
});

document.on('click', '.search_results a.page', function(e,el) {
  e.stop();
  var url = el.getAttribute('href')
  , query = el.getAttribute('data-attribute-query')
  , page = el.getAttribute('data-attribute-page');

  Search.fetch(url, query, page);
});



Session = {
  redirectUrl: function(redirect_url) {
    window.location = redirect_url
  },
  redirectPath: function(redirect_path) {
    window.location.path = redirect_path
  }
}
document.on("dom:loaded", function() {
  return // Disabling splash screen until the UI is more stable to create a new one. FIXME
  if(typeof(my_user) == "undefined") return

  if(my_user.splash_screen) {
    $(document.body).insert({
      top: "<div id='splash'><a id='hide_splash' href='/disable_splash'><img src='/images/splash.jpg'/></a></div>"
    })
    $('container').hide()

    document.on("click", "#hide_splash", function(e,link) {
      Event.stop(e)
      new Ajax.Request(link.href, { method: 'get' })
      $('container').show()
      $('splash').fade()
      window.location.hash = ""
    })
  }
})
document.on('click', '.task_header .text_actions a[href$="/edit"]', function(e, link) {
  if (!e.isMiddleClick()) {
    e.stop()
    link.up('.task_header').hide().next('form.edit_task').forceShow().focusFirstElement()
  }
})

var hideEditTaskFormAndShowHeader = function(form) {
  Form.reset(form).hide().previous('.task_header').show()
}

document.on('click', '.task_header + .edit_task a[href="#cancel"]', function(e, link) {
  e.stop()
  hideEditTaskFormAndShowHeader(link.up('.edit_task'))
})

document.on('keyup', '.task_header + .edit_task', function(e, form) {
  if (e.keyCode == Event.KEY_ESC) hideEditTaskFormAndShowHeader(form)
})

document.on('ajax:success', '.task_header + form.edit_task', function(e, form) {
  var name = form.down('input[name="task[name]"]').getValue()
  form.up('.content').select('.task_header h2, .task .thread_title a.task').invoke('update', name)

  hideEditTaskFormAndShowHeader(form)
})

Task = {

  sortableChange: function(draggable) {
    this.currentDraggable = draggable
  },

  sortableUpdate: function() {
    var taskId = this.currentDraggable.readAttribute('data-task-id'),
        taskList = this.currentDraggable.up('.task_list')
        taskListId = taskList.readAttribute('data-task-list-id')

    taskIds = taskList.select('.tasks .task').collect(
      function(task) {
          return task.readAttribute('data-task-id')
      }).join(',')

    new Ajax.Request('/projects/' + current_project + '/tasks/' + taskId + '/reorder', {
      method: 'put',
      parameters: { task_list_id: taskListId, task_ids: taskIds }
    })
  }.debounce(100),

  makeSortable: function(task_id, all_task_ids) {
    Sortable.create(task_id, {
      constraint: 'vertical',
      containment: all_task_ids,
      handle: 'task_drag',
      dropOnEmpty: true,
      tag: 'div',
      onChange: Task.sortableChange.bind(Task),
      onUpdate: Task.sortableUpdate.bind(Task)
    })
  },

  make_all_sortable: function() {
    var task_div_ids = $$(".tasks.open").map(function(task_div){
      return task_div.identify();
    })
    task_div_ids.each(function(task_div_id){
      Task.makeSortable(task_div_id, task_div_ids);
    })
  },

  highlight_my_tasks: function() {
    $$(".task.user_"+my_user.id).invoke('addClassName', 'mine')
  },

  insertTask: function(task_list_id, archived, task_id, html) {
    var container = archived ? $(task_list_id + '_the_closed_tasks') : $(task_list_id + '_the_main_tasks');
    container.insert({bottom: html});
    new Effect.Highlight(task_id, { duration: 3 });
    TaskList.updateList(task_list_id);
  },

  removeTask: function(task_list_id, task_id) {
    $(task_id).remove();
    TaskList.updateList(task_list_id);
  },

  replaceTasks: function(task_list_id, archived, html) {
    var container = archived ? $(task_list_id + '_the_closed_tasks') : $(task_list_id + '_the_main_tasks');
    container.innerHTML = html;
    TaskList.updateList(task_list_id);
  },

  insertAssignableUsers: function() {
    if (typeof _people == "object") {
      $$('form.new_comment.edit_task .task_actions select#task_assigned_id, form.new_comment.edit_conversation .conversation_actions select#conversation_assigned_id, #new_task select#task_assigned_id').each(function(select) {
        var project_id = select.up('form').readAttribute('data-project-id')
        if (!select.descendants().any() && typeof I18n == "object") {
          select.insert(new Element('option').insert(I18n.translations.comments['new'].assigned_to_nobody))
        }
        if (typeof _people[project_id] == "object") {
          _people[project_id].each(function(person) {
            if (!select.select('[value=' + person[0] + ']').any()) {
              var option = new Element('option', { 'value': person[0] }).insert(person[2])
              if (select.readAttribute('data-assigned') == person[0]) option.selected = true
              select.insert(option)
            }
          })
        }
      })
    }
  },

  classesForListed: function(task) {
    var classes = []
    var due_date = task.due_on ? new Date(Date.parse(task.due_on)) : null
    var now = new Date()
    if (due_date) {
      if (due_date.is_today())
        classes.push('due_today')
      if (due_date.is_tomorrow())
        classes.push('due_tomorrow')
      if (due_date.is_within(now.add_weeks(1)))
        classes.push('due_week')
      if (due_date.is_within(now.add_weeks(2)))
        classes.push('due_2weeks')
      if (due_date.is_within(now.add_weeks(3)))
        classes.push('due_3weeks')
      if (due_date.is_within(now.add_months(1)))
        classes.push('due_month')
      if (due_date - ((new Date()).beginning_of_day()) < 0)
        classes.push('overdue')
    }
    if (!task.due_on)
      classes.push('unassigned_date')
    classes.push('status_' + Task.statusName(task))
    if (task.status != 1) // !open?
      classes.push('status_notopen')
    if (task.due_on && !(task.status == 3 || task.status == 4)) // !(rejected||resolved)
      classes.push('due_on')
    if (!(task.status == 3 || task.status == 4))
      classes.push((task.assigned_id != 0) ? 'assigned' : 'unassigned')
    if (task.assigned)
      classes.push('user_' + task.assigned.user_id)
    if (task.is_private)
      classes.push('private')
    return classes.join(' ')
  },

  nameForAssigned: function(task) {
    if (!task.assigned)
      return ''
    return I18n.t(I18n.translations.common.format_name_short, {
      first_name: task.assigned.user.first_name, last_name: task.assigned.user.last_name,
      first_name_first_character: task.assigned.user.first_name.substr(0,1),
      last_name_first_character: task.assigned.user.last_name.substr(0,1)
    }).escapeHTML()
  },

  linkToNameForAssigned: function(task) {
    if (!task.assigned)
      return ''
    return '<a href="/users/' + task.assigned.user.username + '">' + Task.nameForAssigned(task) + '</a>';
  },

  fullNameForAssigned: function(task) {
    if (!task.assigned)
      return ''
    return I18n.t(I18n.translations.common.format_name, {
      first_name: task.assigned.user.first_name, last_name: task.assigned.user.last_name
    }).escapeHTML()
  },

  dateForDueOn: function(task) {
    var due_date = task.due_on ? new Date(Date.parse(task.due_on)) : null
    if (!due_date)
      return ''
    if (due_date - (new Date().beginning_of_day()) < 0 && due_date.days_since() <= 5)
      return I18n.t(I18n.translations.tasks.overdue, {days: due_date.days_since()})
    else {
      if (due_date.is_today())
        return I18n.t(I18n.translations.tasks.due_on.today)
      else if (due_date.is_tomorrow())
        return I18n.t(I18n.translations.tasks.due_on.tomorrow)
      else
        return due_date.strftime('%b %D')
    }
  },

  statusName: function(task) {
    return ['new', 'open', 'hold', 'resolved', 'rejected'][task.status]
  },

  renderMyTask: function(task) {
    return Mustache.to_html(Templates.tasks.my_task, {
      task_id: task.id,
      task_classes: Task.classesForListed(task),
      task_url: '/projects/' + task.project_id + '/tasks/' + task.id,
      task_name: task.name,
      task_due: Task.dateForDueOn(task)
    })
  }
}

document.on('click', 'a.show_archived_tasks_link', function(e, el) {
  e.stop();
  var task_container_id = el.up('.task_list').id;
  var task_list_id = $(task_container_id).up().id;
  el.hide();
  el.up().down('.loading').show();
  TaskList.reloadList($(task_container_id), 'tasks', function(req){
    el.up().remove();
    new Effect.BlindDown(task_list_id + '_the_closed_tasks', {duration:0.3});
  });
});

document.on('ajax:success', '.new_task form', function(e){
  setTimeout(function(){
    Task.highlight_my_tasks();
    Task.make_all_sortable();
    TaskList.saveColumn();
    TaskList.updatePage('column', TaskList.restoreColumn);
    my_user.stats.tasks++;
    document.fire("stats:update");
  }, 0);
})

document.observe('dom:loaded', function(e) {
  if(typeof(my_user) == "undefined") return

  if ($$('.tasks').length > 0 && !$('tasks_for_all_projects')) {
    Task.make_all_sortable()
  }
  Task.highlight_my_tasks()
  Filter.populatePeopleForTaskFilter()
  Filter.updateCounts(false)
  Filter.updateFilters()
  Task.insertAssignableUsers()
});

document.on('task:updated', function(e, doc){
  var task_data = e.memo
  var is_assigned_to_me = (task_data.status == 1) && task_data.assigned && task_data.assigned.user_id == my_user.id

  var counter = $$('.task_counter[data-task-id='+ task_data.id +']').first()
  if (counter) counter.update(parseInt(counter.innerHTML) + 1)

  var task = $('task_' + task_data.id)
  var task_classes = Task.classesForListed(task_data)
  if (task) {
    var due_on = task.down('.assigned_date')
    var assigned_user = task.down('.assigned_user')
    due_on.update(Task.dateForDueOn(task_data))
    assigned_user.update(Task.linkToNameForAssigned(task_data))
    task.writeAttribute('class', 'task expanded ' + task_classes)
    task.writeAttribute('data-user-id', task_data.user_id)
    task.writeAttribute('data-watcher-ids', (task_data.watchers||[]).join(','))
  }

  task = $('thread_task_' + task_data.id)
  if (task) {
    var summary = task.down('.task_summary')
    summary.writeAttribute('class', 'task_summary ' + task_classes)
    summary.down('.task_status').writeAttribute('class', 'task_status task_status_' + Task.statusName(task_data))
    summary.down('.task_status').update(Task.statusName(task_data))
    summary.down('.assigned_date').update(Task.dateForDueOn(task_data))
    summary.down('.assigned_to').update(task_data.assigned ? I18n.t(I18n.translations.tasks.assigned.assigned_to, {user: Task.fullNameForAssigned(task_data)}) : '')

    task.writeAttribute('data-user-id', task_data.user_id)
    task.writeAttribute('data-watcher-ids', (task_data.watchers||[]).join(','))
    var counter = task.down('.comment_header').down('.comment_count').down()
    if (counter) counter.update(parseInt(counter.innerHTML) + 1)
  }

  var task_sidebar = $('my_task_' + task_data.id);
  if (task_sidebar) {
    if (is_assigned_to_me) {
      task_sidebar.writeAttribute('class', 'el task ' + task_classes)
      task_sidebar.down('.due_on').update(Task.dateForDueOn(task_data))
    } else {
      task_sidebar.remove()
    }
  } else if (is_assigned_to_me) {
    $('my_tasks').next().insert({top:Task.renderMyTask(task_data)})
  }

  $('open_my_tasks').update($('my_tasks').next().getElementsBySelector('.el.task').length)

  task_sidebar = $('task_list_task_' + task_data.id);
  if (task_sidebar) {
    task_sidebar.writeAttribute('class', 'task ' + task_classes)
    task_sidebar.down('.due_on').update(Task.dateForDueOn(task_data))
  }
})

document.on('ajax:success', 'form.edit_task', function(e, form) {
  var task_data = e.memo.headerJSON
  if (!task_data)
    return

  document.fire('task:updated', task_data)

  var assigned_user_id = task_data.assigned ? task_data.assigned.user_id : 0
  var is_assigned_to_me = (task_data.status == 1) && assigned_user_id == my_user.id

  form.writeAttribute('data-mine', String(Boolean(is_assigned_to_me)))
})


document.on('ajax:failure', 'form.new_task.app_form', function(e, form) {
  var message = $H(e.memo.responseJSON)
	message.keys().each( function(k) {
		field = form.down('#task_'+k)
		if (field) field.parentNode.insertOrUpdate('span.error', message.get(k))
	})
})

document.on('ajax:before', 'form.new_task.app_form', function(e, form) {
  form.select('span.error').invoke('remove')
})

document.on('ajax:success', '.task_list form.new_task', function(e, form) {
  var person = form['task[assigned_id]'].getValue()
  var task_count = Number($('open_my_tasks').innerHTML)
  var is_assigned_to_me = my_projects[person]

  var response = e.memo.responseText
  resetCommentsForm(form)

  if (is_assigned_to_me) {
    task_count += 1
    $('open_my_tasks').update(task_count)
  }

  Form.reset(form).focusFirstElement().up('.task_list').down('.tasks').insert(response)
})

var TaskList = {
  in_sort: false,

  sortableChange: function(draggable) {
    this.currentDraggable = draggable
  },

  sortableUpdate: function() {
    task_list_ids = this.currentDraggable.up().select('.task_list').collect(
    function(task_list) {
        return task_list.readAttribute('data-task-list-id')
    }).join(',')

    new Ajax.Request('/projects/' + current_project + '/task_lists/reorder', {
      method: 'put',
      parameters: { task_list_ids: task_list_ids }
    })
  }.debounce(100),

  makeSortable: function() {
    TaskList.in_sort = true;
    Sortable.create('task_lists', {
      constraint:'vertical',
      handle:'img.drag',
      tag:'div',
      only:'task_list_container',
      onChange: TaskList.sortableChange.bind(TaskList),
      onUpdate: TaskList.sortableUpdate.bind(TaskList)
    });
  },
  destroySortable: function() {
    TaskList.in_sort = false;
    Sortable.destroy('task_lists');
  },

  insertList: function(id, content, archived) {
    if (archived)
      $('task_lists').insert({bottom: content});
    else
      $('task_lists').insert({top: content});
    new Effect.Highlight(id, {duration:3});
  },

  replaceList: function(id, content, archived) {
    var existing = $(id);
    if (!id)
      TaskList.insertList(id,content,archived);
    else
      existing.replace(content);
  },

  removeList: function(id) {
    var el = $(id);
    if (el)
    {
      el.remove();
    }
  },

  updateList: function(id) {
    var list = $(id);
    if (!list)
      return;

    var open = $(id + '_the_main_tasks');
    var archived = $(id + '_the_closed_tasks');
    var open_count = open.childElements().length;
    var archived_count = archived.childElements().length;
    var link = $(id + '_archive_link');
    if (open_count == 0 && archived_count > 0)
      link.show();
    else
      link.hide();
  },

  setArchived: function(id, value) {
    var el = $(id);
    if (el) {
      if (value)
        el.addClassName('archived');
      else
        el.removeClassName('archived');
    }
  },

  destroy: function(element, url) {
    new Ajax.Request(url, {
      method: 'delete',
      asynchronous: true,
      evalScripts: true,
      onLoading: function() {
        Actions.setLoading(element, true);
      },
      onSuccess: function(response){
        setTimeout(function(){TaskList.updatePrimer();}, 0);
      },
      onFailure: function(response){
        Actions.setLoading(element, false);
      }
    });
  },

  updateForm: function(element, url) {
    new Ajax.Request(url, {
      method: 'get',
      asynchronous: true,
      evalScripts: true,
      onLoading: function() {
        Actions.setLoading(element, true);
      },
      onSuccess: function(response){
        Actions.setActions(element, false);
        Actions.setLoading(element, false);
      },
      onFailure: function(response){
        Actions.setLoading(element, false);
      }
    });
  },

  resolveAndArchive: function(element, url) {
    new Ajax.Request(url, {
      method: 'put',
      asynchronous: true,
      evalScripts: true,
      onLoading: function() {
        Actions.setLoading(element, true);
      },
      onSuccess: function(response){
        TaskList.saveColumn();
        TaskList.updatePage('column', TaskList.restoreColumn);
      },
      onFailure: function(response){
        Actions.setLoading(element, false);
      }
    });
  },

  unarchive: function(element, url) {
    new Ajax.Request(url, {
      method: 'put',
      asynchronous: true,
      evalScripts: true,
      parameters:'task_list[archived]=false',
      onLoading: function() {
      },
      onSuccess: function(response){
        TaskList.saveColumn();
        TaskList.updatePage('column', TaskList.restoreColumn);
      },
      onFailure: function(response){
      }
    });
  },

  saveColumn: function() {
    var saved = {};
    if ($('filter_assigned'))
    {
      saved.filter_assigned = $('filter_assigned').selectedIndex;
      saved.filter_due_date = $('filter_due_date').selectedIndex;
    }
    TaskList.saved = saved;
  },

  restoreColumn: function() {
    var saved = TaskList.saved;
    if (saved) {
      if (saved.filter_assigned)
      {
        $('filter_assigned').selectedIndex = saved.filter_assigned;
        $('filter_due_date').selectedIndex = saved.filter_due_date;
      }
    }
    Filter.updateCounts();
  },

  updatePage: function(part, callback) {
    var el = $(document.body);
    var url = el.readAttribute('reload_url');
    if (!url)
      return;
    url = url.indexOf('?') >= 0 ? (url + '&part=' + part) : (url + '?part=' + part);
    new Ajax.Request(url, {
      asynchronous: true,
      evalScripts: true,
      method: 'get',
      onComplete: callback
    });
  },

  reloadList: function(el, part, callback) {
    var url = el.readAttribute('action_url');
    var on_index = el.hasClassName('index_task_lists');
    if (!url)
      return;
    url = url.indexOf('?') >= 0 ? (url + '&part=' + part) : (url + '?part=' + part);
    if (on_index)
      url = url + '&on_index=1';
    new Ajax.Request(url, {
      asynchronous: true,
      evalScripts: true,
      method: 'get',
      onComplete: function(request) {
        callback(request);
        Task.make_all_sortable();
      }
    });
  },

  setTitle: function(element, visible) {
    var title = $(element.readAttribute('toggleformbase') + 'title');
    if (title == null)
      return;
    if (visible)
      title.show();
    else
      title.hide();
  },

  setReorder: function(active) {
    $$('.task_list_container').invoke(active ? 'addClassName' : 'removeClassName', 'reordering')

    if (active) {
      $('reorder_task_lists_link').swapVisibility('done_reordering_task_lists_link')
      Filter.showAllTaskLists()
      $$('.filters').invoke('hide')
      TaskList.makeSortable()
    } else {
      $('done_reordering_task_lists_link').swapVisibility('reorder_task_lists_link')
      Filter.updateFilters()
      $$('.filters').invoke('show')
      TaskList.destroySortable()
    }
  },

  updatePrimer: function() {
    var primer = $('primer');
    if (primer && $$('.task_list').length == 0)
      primer.show();
    else if (primer)
      primer.hide();
  },
  populateTaskListSelect: function(project_id, select, callback) {

    new Ajax.Request('/api/1/projects/' + project_id + '/task_lists.json', {
      method:'get',
      requestHeaders: {Accept: 'application/json'},
      onSuccess: function(transport){
        var json = transport.responseText.evalJSON(true);
        select.options.length = 0;
        json.objects.each(function(taskList) {
          select.options.add(new Option(taskList.name, taskList.id));
        });

        if (!select.childElements().any(function(option) {return option.text == 'Inbox';})) {
          select.options.add(new Option("Inbox", ''));
        }
      },
      onFailure: function() {
        alert('Error loading page! Please reload.');
        if (callback) {
          callback();
        }
      }
    });
  },

  switchToTemplate: function() {
    $('traditional_task_list_form').hide()
    $('task_list_name').value = ""
    $('template_task_list_form').show()
  },

  switchFromTemplate: function() {
    $('template_task_list_form').hide()
    $('traditional_task_list_form').show()
  }
};

document.on('click', '#traditional_task_list_form a.create_from_template', function(e, el) {
  TaskList.switchToTemplate()
  e.stop()
})

document.on('click', '#template_task_list_form a.create_traditional', function(e, el) {
  TaskList.switchFromTemplate()
  e.stop()
})

document.on('click', '#reorder_task_lists_link', function(e, element){
  e.stop()
  TaskList.setReorder(true);
});

document.on('click', '#done_reordering_task_lists_link', function(e, element){
  e.stop()
  TaskList.setReorder(false);
});

document.observe('toggleform:loaded:edit_task_list', function(evt) {
  if (TaskList.in_sort) {
    setTimeout(function(){
      TaskList.setReorder(false);
      TaskList.setReorder(true);
    }, 0);
  }
  TaskList.saveColumn();
  TaskList.updatePage('column', TaskList.restoreColumn);
});

document.observe('toggleform:loaded:new_task_list', function(evt) {
  if (TaskList.in_sort) {
	setTimeout(function(){
      TaskList.setReorder(false);
      TaskList.setReorder(true);
    }, 0);
  }
  setTimeout(function(){
    Task.make_all_sortable();
    TaskList.updatePrimer();
    TaskList.saveColumn();
  }, 0);
});

document.observe('toggleform:cancel:edit_task_list', function(evt) {
  if (evt.memo.form.up('.task_list_container'))
  {
    TaskList.setTitle(evt.memo.form, true);
    Actions.setActions(evt.memo.form, true);
  }
  else
  {
    evt.memo.form.up().down(".task_header").show();
  }
});

document.on('click', 'a.taskListUpdate', function(e, el) {
  e.stop();
  TaskList.updateForm(el, el.readAttribute('href'));
});

document.on('click', 'a.taskListDelete', function(e, el) {
  e.stop();
  if (confirm(el.readAttribute('aconfirm')))
    TaskList.destroy(el, el.readAttribute('action_url'));
});

document.on('click', 'a.taskListResolve', function(e, el) {
  e.stop();
  if (confirm(el.readAttribute('aconfirm')))
    TaskList.resolveAndArchive(el, el.readAttribute('action_url'));
});

document.on('click', 'a.create_first_task_list_link', function(e, el) {
  e.stop();
  ToggleForm.toggleElement(el); // edit form on task list show
});

document.on('click', 'a.edit_task_list_link', function(e, el) {
  e.stop();
  ToggleForm.toggleElement(el); // edit form on task list show
});

document.on('click', 'a.unarchive_task_list_link', function(e, el) {
  e.stop();
  TaskList.unarchive(el, el.readAttribute('action_url'));
});

document.on('click', '.task_list .new_task a[href$="/new"]', function(e, link) {
  if (!e.isMiddleClick()) {
    e.stop()
    link.hide().next('form').forceShow().focusFirstElement()
  }
})

var hideTaskFormAndShowLink = function(form) {
  Form.reset(form).hide().previous('a[href$="/new"]').show()
}

document.on('click', '.task_list .new_task form a[href="#cancel"]', function(e, link) {
  e.stop()
  hideTaskFormAndShowLink(link.up('form'))
})

document.on('keyup', '.task_list .new_task form', function(e, form) {
  if (e.keyCode == Event.KEY_ESC) hideTaskFormAndShowLink(form)
})
TaskListTemplates = {

  renderAll: function(templates) {
    var placeholder = $('task_list_templates')
    templates.each(function(template) {
      var t = TaskListTemplates.render(template)
      placeholder.insert(t)
    })
  },

  render: function(template) {
    return Mustache.to_html(Templates.task_list_templates.template, template)
  },

  generateForm: function(id) {
    if (id) {
      var e = $$('.task_list_templates[data-id=' + id + ']').first()
      template = Object.clone(_task_list_templates.find(function(e) { return e.id == id }))
      template.tasks = template.tasks.clone()
      template.verb = 'put'
      template.action = 'edit'
      template.path = '/organizations/' + template.organization + '/task_list_templates/' + id
    } else {
      var e = $('task_list_templates')
      template = { organization: _task_list_templates_organization, tasks: [] }
      template.verb = 'post'
      template.action = 'new'
      template.path = '/organizations/' + template.organization + '/task_list_templates'
    }
    template.tasks.push({name: '', desc: ''})
    if (e.down('form')) { e.down('form').remove() }
    e.insert({ top: Mustache.to_html(Templates.task_list_templates.form, template) })
    TaskListTemplates.sortableForm()
  },

  addField: function(el) {
    if (!el.down('ul input[name="task_list_template[titles][]"][value=]')) {
      el.down('ul').insert(Mustache.to_html(Templates.task_list_templates.form_task, {} ))
      TaskListTemplates.sortableForm()
    }
  },

  doneEditingName: function(id, template) {
    if (id) {
      var e = $$('.task_list_templates[data-id=' + id + ']').first()
    } else {
      var e = $$('form.new_task_list_template').first()
    }
    _task_list_templates = _task_list_templates.reject(function(e) { return e.id == template.id })
    _task_list_templates.push(template)
    e.replace(TaskListTemplates.render(template))
    TaskListTemplates.sortable()
  },

  sortable: function() {
    Sortable.create('task_list_templates', {
      handle: 'drag',
      tag: 'div',
      onChange: function(el) {
        TaskListTemplates.sendSort()
      }
    })
  },

  sortableForm: function() {
    Sortable.create('template_tasks', {
      handle: 'drag',
      tag: 'li'
    })
  },

  sendSort: function(el) {
    var ids = $$('.task_list_templates').collect(function(e) { return e.readAttribute('data-id') })
    var organization = _task_list_templates_organization
    new Ajax.Request('/organizations/' + organization + '/task_list_templates/reorder', {
      method: 'put',
      parameters: Sortable.serialize('task_list_templates')
    })
  },

  loadPage: function() {
    if ($('task_list_templates')) {
      $('task_list_templates').update('')
      TaskListTemplates.renderAll(_task_list_templates)
      TaskListTemplates.sortable()
    }
  }
}

document.on('ajax:success', 'form.edit_task_list_template', function(e, form) {
  var id = form.up('.task_list_templates').readAttribute('data-id')
  var response = e.memo.responseJSON
  TaskListTemplates.doneEditingName(id, response)
})

document.on('ajax:success', 'form.new_task_list_template', function(e, form) {
  var response = e.memo.responseJSON
  TaskListTemplates.doneEditingName(null, response)
})

document.on('click', '.task_list_templates .edit_icon', function(e, el) {
  var t = el.up('.task_list_templates')
  TaskListTemplates.generateForm(t.readAttribute('data-id'))
  t.down('.data').hide()
  e.stop()
})

document.on('click', '.task_list_templates .trash_icon', function(e, el) {
  var t = el.up('.task_list_templates')
  var id = t.readAttribute('data-id')
  if (confirm('Sure?')) {
    new Ajax.Request('/organizations/' + _task_list_templates_organization + '/task_list_templates/' + id, { method: 'delete' })
    t.remove()
    _task_list_templates = _task_list_templates.reject(function(e) { return e.id == id })
  }
  e.stop()
})

document.on('click', 'a.new_task_list_template', function(e, el) {
  TaskListTemplates.generateForm()
  e.stop()
})

document.on('click', 'form.new_task_list_template a.cancel, form.edit_task_list_template a.cancel', function(e,el) {
  if (el.up('.task_list_templates')) { el.up('.task_list_templates').down('.data').show() }
  el.up('form').remove()
  e.stop()
})

document.on('keyup', 'form.new_task_list_template ul input[name="task_list_template[titles][]"], form.edit_task_list_template ul input[name="task_list_template[titles][]"]', function(e, el) {
  TaskListTemplates.addField(el.up('form'))
})

InlineTasks = {

  toggleFold: function(task) {
    var block_id = "inline_"+task.readAttribute("id")

    if (task.hasClassName('expanded')) {
      task.removeClassName('expanded')
      new Effect.BlindUp(block_id, {duration: 0.5});
      new Effect.Fade(task.down('.expanded_actions'), {duration: 0.5})
      setTimeout(function() { $(block_id).remove() }, 500 )
    } else {
      if (!task.down('.loading_icon')) {
        task.down('span.task_status').insert({ before: "<div class='loading_icon'> </div>" })
        task.down('span.task_status').hide()
      }
      new Ajax.Request(task.down('a.name').readAttribute('href')+".html?nolayout=1", {
        method: "get",
        onSuccess: function(r) {
          task.down('.loading_icon').remove()
          task.down('span.task_status').show()
          var block = "<div class='task_inline' style='display:none' id='"+block_id+"'>"+r.responseText+"</div>"
          task.insert({ bottom: block })
          new Effect.BlindDown(block_id, {duration: 0.5})
          new Effect.Appear(task.down('.expanded_actions'), {duration: 0.5})
          task.addClassName('expanded')
          Date.format_posted_dates()
          Task.insertAssignableUsers()
        },
        onFailure: function(r) {
          task.down('.loading_icon').remove()
          task.down('span.task_status').show()
        }
      })
    }
  }

}
document.on('click', '.task_list_container a.name, .task_list_container a.hide', function(e, el) {
  if (e.isMiddleClick()) return
  e.stop()

  InlineTasks.toggleFold(el.up('.task'))
})

Threads = {
  selectNext: function() {
    Threads.move('next')
  },
  selectPrevious: function() {
    Threads.move('previous')
  },
  move: function(direction) {
    if (!$$('.thread').any()) { return true }
    var sel = $$('.thread.selected').first()
    if (!sel) { sel = $$('.thread').first() }
    var next = sel[direction]('.thread')
    var btn = $('activity_paginate_link')
    if (sel && next) {
      Threads.select(next)
      Threads.ensureVisible(next)
    }
    else if (!next && direction == 'next' && btn && btn.visible())
    {
      btn.fire('pseudo:click')
    }

  },
  select: function(element) {
    $$('.thread.selected').invoke('removeClassName','selected')
    element.addClassName('selected')
  },
  ensureVisible: function(element) {
      var offsetTop = element.viewportOffset().top
      if ( offsetTop < 0 || offsetTop + element.getHeight() > document.viewport.getHeight() )
      {
        Effect.ScrollTo(element, { duration: '0.4', offset: -40 })
      }
  },
  toggleSelected: function() {
    ActivityFeed.toggle($$('.thread.selected').first())
  }
}

document.on('dom:loaded', function() {
  Hotkeys.key('j', function() { Threads.selectNext() })
  Hotkeys.key('k', function() { Threads.selectPrevious() })
  Hotkeys.key('enter', function() { Threads.toggleSelected() })
})

Upload = {

  renderMoveForm: function(el) {

    moveable_id = Upload.getIdFromElement(el);
    moveable_type = Upload.getMoveableTypeFromElement(el);

    return Mustache.to_html(Templates.uploads.move, {
        moveable_id: moveable_id,
        path: '/projects/' + current_project + '/move/' + moveable_id,
        folders: Upload.parseTargetFolders(),
        moveable_type: moveable_type,
        moveable: moveable_type + "_" + moveable_id
    });
  },

  parseTargetFolders: function() {
     if(moveable_type == 'folder') {
       return target_folders.reject(function(f) { return f.id == moveable_id });
     }
     return target_folders;
  },

  splitElementId: function(el) {
    el_id = el.hasAttribute('id') ? el.getAttribute('id') : el.up('.upload').getAttribute('id');
    arr = el_id.split('_');
    return arr;
  },

  getIdFromElement: function(el) {
    splitted = Upload.splitElementId(el);
    return splitted[1];
  },

  getMoveableTypeFromElement: function(el) {
    splitted = Upload.splitElementId(el);
    return splitted[0];
  },

  dropOutMoveableItem: function(moveable_id) {
    var moveable = $(moveable_id);
    $(moveable).dropOut();
  },

  submitMoveForm: function() {
    $('move_form').request({
      method: 'put',
      onLoading: function(transport) { Upload.dropOutMoveableItem(transport.request.parameters['moveable']); },
      onSuccess: Facebox.close()
    });
  }

}

document.on('click', '.upload .reference a.move_resource', function(e, el){

  e.preventDefault();
  move_html = Upload.renderMoveForm(el);

  Prototype.Facebox.open(move_html, 'html move_to_folder_box', {
      buttons: [
          {className: 'close', href: '#close', description: I18n.translations.common.cancel},
          {className: 'confirm', href: 'javascript:Upload.submitMoveForm()', description: I18n.translations.common.move}]
	});
});

document.on('click', '#upload_file_button', function(e, button) {
  e.preventDefault();
  $('new_upload').toggle();
});

document.on("click", ".upload .file a.ajax", function(e,el) {
  el.up('.upload').down('img').setAttribute('src', '/images/loading.gif');
});

document.on("click", ".upload .reference a.link_rename", function(e,el) {
  el.up('.reference').hide();
  el.up('.reference').up('.upload').down('.header').down('.icon').down('img').setAttribute('src', '/images/loading.gif');
});

document.on('click', '#new_folder_button, #new_folder_form a.close', function(e, button) {
  e.preventDefault();
  $('new_folder_form').toggle();
  if ($('new_folder_form').visible()) {
    $('new_folder_form').down('#new_folder_name').focus();
  }
});

String.prototype.incrementLastNumber = function() {
  var i = 0, matches = this.match(/\d+/g);
  matches.push(parseInt(matches.pop()) + 1);
  return this.gsub(/\d+/, function(m) { return matches[i++]; });
};

document.on('change', '.upload_area input[type=file]', function(e, input) {
  var newInput = new Element('input', {
    type: 'file',
    name: input.name.incrementLastNumber()
  });
  if (input.form.hasEmptyFileUploads() === false) {
    input.insert({ after: newInput });
  }
});

var toggle_task_row = function(el) {
  var upload = el.up('.upload');
  var reference = upload.down('.reference');
  if(reference) {
    if (reference.visible()) {
      upload.removeClassName('selected');
      reference.hide();
    } else {
      $$('.uploads .upload').invoke('removeClassName', 'selected');
      $$('.uploads .reference').invoke('hide');
      upload.addClassName('selected');
      reference.show();
    }
  }
};

document.on('click', '.uploads .upload .header .file a', function(e, el) {
  toggle_task_row(el);
});

document.on('click', '.uploads .upload .header', function(e, el) {
  toggle_task_row(el);
});
Watchers = {
  toggleBox: function(form, project_id) {
    this.redrawBox(form, project_id);
    form.down(".add_watchers_box").toggle();
  },
  redrawBox: function(form, project_id) {
    form.select(".watcher").invoke("remove");
    form.down(".add_watchers_box").insert({ bottom: this.watchersHTML(project_id) });
  },
  watchersHTML: function(project_id) {
    var people = _people[project_id];
    var html = "";
    html = "<div class='watcher'><a href='#' data-login='all'><strong>All users</strong></a></div>";
    html += people.collect(function(p) {
      if (p[3] == my_user.id) { return null; }
      return "<div class='watcher'><a href='#' data-login='"+p[1]+"'>"+p[2]+"</a></div>";
    }).compact().join("");
    return html;
  }
};

document.on("click", "a.add_watchers", function(e,el) {
  e.stop();
  var form = el.up('form');
  var select = form.down('select#project_id');
  var project_id = form.readAttribute('data-project-id') || select.select('option').find(function(ele){return !!ele.selected;}).value;
  Watchers.toggleBox(form, project_id);
});

document.on("change", "select#project_id", function(e,el) {
  var select = el;
  var form = el.up("form");
  var project_id = select.select('option').find(function(ele){return !!ele.selected;}).value;
  Watchers.redrawBox(form, project_id);
});

document.on("click", ".watcher a", function(e,el) {
  e.stop();
  var textarea = el.up("form").down("textarea");
  var login = el.readAttribute('data-login');
  if (textarea.value.length > 0 && textarea.value[textarea.value.length-1] != " ") {
    textarea.value += " ";
  }
  textarea.value += "@"+login+" ";
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
});

document.on("keyup", "form.new_conversation textarea", function(e,el) {
  if (el.value.length === 0) { return; }

  if (Watchers.notify_people_span) { return; }
  Watchers.notify_people_span = true;

  var note = el.up("form").down("span.new");
  note.show();
  var e1 = new Effect.Move(note, { x: 50, transition: Effect.Transitions.linear, duration: 0 });
  var e2 = new Effect.Move(note, { x: -50, transition: Effect.Transitions.spring, duration: 1.0 });
});
document.on('click', '.index_watchers .remove a', function(e, link) {
  e.stop()
  var container = link.up('.watch')

  new Ajax.Request(link.href, {
    method: 'post',
    asynchronous: true,
    evalScripts: true,
    onLoading: function() {
      link.fade()
    },
    onSuccess: function() {
      container.fade()
    },
    onFailure: function() {
      link.show()
    }
  })
})
