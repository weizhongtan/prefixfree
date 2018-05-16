/**
 * StyleFix 1.0.3 & PrefixFree 1.0.7
 * @author Lea Verou
 * MIT license
 */

/**
 * PrefixFree
 */
var PrefixFree = (function(root){

if(!window.getComputedStyle) {
	return;
}

// only required methods from StyleFix
var StyleFix = {
	camelCase: function(str) {
		return str.replace(/-([a-z])/g, function($0, $1) { return $1.toUpperCase(); }).replace('-','');
	},

	deCamelCase: function(str) {
		return str.replace(/[A-Z]/g, function($0) { return '-' + $0.toLowerCase() });
	}
};

// Private helper
function fix(what, before, after, replacement, css) {
	what = self[what];

	if(what.length) {
		var regex = RegExp(before + '(' + what.join('|') + ')' + after, 'gi');

		css = css.replace(regex, replacement);
	}

	return css;
}

var self = {
	prefixCSS: function(css, raw, element) {
		var prefix = self.prefix;

		// Gradient angles hotfix
		if(self.functions.indexOf('linear-gradient') > -1) {
			// Gradients are supported with a prefix, convert angles to legacy
			css = css.replace(/(\s|:|,)(repeating-)?linear-gradient\(\s*(-?\d*\.?\d*)deg/ig, function ($0, delim, repeating, deg) {
				return delim + (repeating || '') + 'linear-gradient(' + (90-deg) + 'deg';
			});
		}

		css = fix('functions', '(\\s|:|,)', '\\s*\\(', '$1' + prefix + '$2(', css);
		css = fix('keywords', '(\\s|:)', '(\\s|;|\\}|$)', '$1' + prefix + '$2$3', css);
		css = fix('properties', '(^|\\{|\\s|;)', '\\s*:', '$1' + prefix + '$2:', css);

		// Prefix properties *inside* values (issue #8)
		if (self.properties.length) {
			var regex = RegExp('\\b(' + self.properties.join('|') + ')(?!:)', 'gi');

			css = fix('valueProperties', '\\b', ':(.+?);', function($0) {
				return $0.replace(regex, prefix + "$1")
			}, css);
		}

		if(raw) {
			css = fix('selectors', '', '\\b', self.prefixSelector, css);
			css = fix('atrules', '@', '\\b', '@' + prefix + '$1', css);
		}

		// Fix double prefixing
		css = css.replace(RegExp('-' + prefix, 'g'), '-');

		// Prefix wildcard
		css = css.replace(/-\*-(?=[a-z]+)/gi, self.prefix);

		return css;
	},

	property: function(property) {
		return (self.properties.indexOf(property) >=0 ? self.prefix : '') + property;
	},

	value: function(value, property) {
		value = fix('functions', '(^|\\s|,)', '\\s*\\(', '$1' + self.prefix + '$2(', value);
		value = fix('keywords', '(^|\\s)', '(\\s|$)', '$1' + self.prefix + '$2$3', value);

		if(self.valueProperties.indexOf(property) >= 0) {
			value = fix('properties', '(^|\\s|,)', '($|\\s|,)', '$1'+self.prefix+'$2$3', value);
		}

		return value;
	},

	prefixSelector: function(selector) {
		return self.selectorMap[selector] || selector
	},

	// Warning: Prefixes no matter what, even if the property is supported prefix-less
	prefixProperty: function(property, camelCase) {
		var prefixed = self.prefix + property;

		return camelCase? StyleFix.camelCase(prefixed) : prefixed;
	}
};

/**************************************
 * Properties
 **************************************/
(function() {
	var prefixes = {},
		properties = [],
		shorthands = {},
		style = getComputedStyle(document.documentElement, null),
		dummy = document.createElement('div').style;

	// Why are we doing this instead of iterating over properties in a .style object? Because Webkit.
	// 1. Older Webkit won't iterate over those.
	// 2. Recent Webkit will, but the 'Webkit'-prefixed properties are not enumerable. The 'webkit'
	//    (lower case 'w') ones are, but they don't `deCamelCase()` into a prefix that we can detect.

	var iterate = function(property) {
		if(property.charAt(0) === '-') {
			properties.push(property);

			var parts = property.split('-'),
				prefix = parts[1];

			// Count prefix uses
			prefixes[prefix] = ++prefixes[prefix] || 1;

			// This helps determining shorthands
			while(parts.length > 3) {
				parts.pop();

				var shorthand = parts.join('-');

				if(supported(shorthand) && properties.indexOf(shorthand) === -1) {
					properties.push(shorthand);
				}
			}
		}
	},
	supported = function(property) {
		return StyleFix.camelCase(property) in dummy;
	}

	// Some browsers have numerical indices for the properties, some don't
	if(style && style.length > 0) {
		for(var i=0; i<style.length; i++) {
			iterate(style[i])
		}
	}
	else {
		for(var property in style) {
			iterate(StyleFix.deCamelCase(property));
		}
	}

	// Find most frequently used prefix
	var highest = {uses:0};
	for(var prefix in prefixes) {
		var uses = prefixes[prefix];

		if(highest.uses < uses) {
			highest = {prefix: prefix, uses: uses};
		}
	}

	self.prefix = '-' + highest.prefix + '-';
	self.Prefix = StyleFix.camelCase(self.prefix);

	self.properties = [];

	// Get properties ONLY supported with a prefix
	for(var i=0; i<properties.length; i++) {
		var property = properties[i];

		if(property.indexOf(self.prefix) === 0) { // we might have multiple prefixes, like Opera
			var unprefixed = property.slice(self.prefix.length);

			if(!supported(unprefixed)) {
				self.properties.push(unprefixed);
			}
		}
	}

	// IE fix
	if(self.Prefix == 'Ms'
	  && !('transform' in dummy)
	  && !('MsTransform' in dummy)
	  && ('msTransform' in dummy)) {
		self.properties.push('transform', 'transform-origin');
	}

	self.properties.sort();
})();

/**************************************
 * Values
 **************************************/
(function() {
// Values that might need prefixing
var functions = {
	'linear-gradient': {
		property: 'backgroundImage',
		params: 'red, teal'
	},
	'calc': {
		property: 'width',
		params: '1px + 5%'
	},
	'element': {
		property: 'backgroundImage',
		params: '#foo'
	},
	'cross-fade': {
		property: 'backgroundImage',
		params: 'url(a.png), url(b.png), 50%'
	},
	'image-set': {
		property: 'backgroundImage',
		params: 'url(a.png) 1x, url(b.png) 2x'
	}
};


functions['repeating-linear-gradient'] =
functions['repeating-radial-gradient'] =
functions['radial-gradient'] =
functions['linear-gradient'];

// Note: The properties assigned are just to *test* support.
// The keywords will be prefixed everywhere.
var keywords = {
	'initial': 'color',
	'grab': 'cursor',
	'grabbing': 'cursor',
	'zoom-in': 'cursor',
	'zoom-out': 'cursor',
	'box': 'display',
	'flexbox': 'display',
	'inline-flexbox': 'display',
	'flex': 'display',
	'inline-flex': 'display',
	'grid': 'display',
	'inline-grid': 'display',
	'max-content': 'width',
	'min-content': 'width',
	'fit-content': 'width',
	'fill-available': 'width',
	'contain-floats': 'width'
};

self.functions = [];
self.keywords = [];

var style = document.createElement('div').style;

function supported(value, property) {
	style[property] = '';
	style[property] = value;

	return !!style[property];
}

for (var func in functions) {
	var test = functions[func],
		property = test.property,
		value = func + '(' + test.params + ')';

	if (!supported(value, property)
	  && supported(self.prefix + value, property)) {
		// It's supported, but with a prefix
		self.functions.push(func);
	}
}

for (var keyword in keywords) {
	var property = keywords[keyword];

	if (!supported(keyword, property)
	  && supported(self.prefix + keyword, property)) {
		// It's supported, but with a prefix
		self.keywords.push(keyword);
	}
}

})();

/**************************************
 * Selectors and @-rules
 **************************************/
(function() {

var
selectors = {
	':any-link': null,
	'::backdrop': null,
	':fullscreen': null,
	':full-screen': ':fullscreen',
	//sigh
	'::placeholder': null,
	':placeholder': '::placeholder',
	'::input-placeholder': '::placeholder',
	':input-placeholder': '::placeholder',
	':read-only': null,
	':read-write': null,
	'::selection': null
},

atrules = {
	'keyframes': 'name',
	'viewport': null,
	'document': 'regexp(".")'
};

self.selectors = [];
self.selectorMap = {};
self.atrules = [];

var style = root.appendChild(document.createElement('style'));

function supported(selector) {
	style.textContent = selector + '{}';  // Safari 4 has issues with style.innerHTML

	return !!style.sheet.cssRules.length;
}

for(var selector in selectors) {
	var standard = selectors[selector] || selector
	var prefixed = selector.replace(/::?/, function($0) { return $0 + self.prefix })
	if(!supported(standard) && supported(prefixed)) {
		self.selectors.push(standard);
		self.selectorMap[standard] = prefixed;
	}
}

for(var atrule in atrules) {
	var test = atrule + ' ' + (atrules[atrule] || '');

	if(!supported('@' + test) && supported('@' + self.prefix + test)) {
		self.atrules.push(atrule);
	}
}

root.removeChild(style);

})();

// Properties that accept properties as their value
self.valueProperties = [
	'transition',
	'transition-property',
	'will-change'
]

// Add class for current prefix
root.className += ' ' + self.prefix;

return self;

})(document.documentElement);

module.exports = PrefixFree;
