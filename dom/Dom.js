/** @license MIT License (c) copyright 2010-2013 original author or authors */

/**
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author Brian Cavalier
 * @author John Hann
 */

(function(define) { 'use strict';
define(function(require) {

	var guessProp = require('../view/lib/dom').guessProp;
	var domPatch = require('./domPatch');
	var template = require('./template');
	var jsonPointer = require('../lib/jsonPointer');
	var jsonPatch = require('../lib/jsonPatch');

	function Dom(node, events) {
		this.node = template.fromNode(node);
		this._lists = findListTemplates(this.node);
		this._events = normalizeEvents(events);
	}

	Dom.prototype = {
		set: function(data) {
			var observe;
			if(this._observe) {
				observe = this._observe;
				eachNodeEventPair(function(node, event) {
					node.removeEventListener(event, observe);
				}, this._events, this.node);
			}

			this._shadow = data;
			this._changes = [];
			observe = this._observe = this._createObserver();
			eachNodeEventPair(function(node, event) {
				node.addEventListener(event, observe, false);
			}, this._events, this.node);

			var self = this;
			return domPatch.set(this.node, data, function(parent, key) {
				var template = self._lists[key];
				if(template) {
					var node = template.cloneNode(true);
					parent.appendChild(node);
					return node;
				}
			});
		},

		update: function(patch) {
			this._shadow = jsonPatch.patch(patch, this._shadow);
			domPatch.patch(this.node, patch, this._lists);
		},

		sync: function() {
			var d = diffDataAndDom(this._changes, this._shadow, this.node);
//			this._changes = [];
			this._shadow = jsonPatch.patch(d, this._shadow);
			return d;
		},

		_createObserver: function() {
			var node = this.node;
			var changes = this._changes = [];
			var self = this;
			return function (e) {
				changes.push(buildPath(e.target, node));
				self.hint(self);
			};
		}
	};

	return Dom;

	function normalizeEvents(events) {
		if (!events) {
			events = { '/': 'change' };
		} else if (typeof events === 'string') {
			events = { '/': events };
		}

		return events;
	}

	function eachNodeEventPair(f, events, root) {
		Object.keys(events).forEach(function(path) {
			var event = events[path];
			event = event.split(/\s*,\s*/);
			event.forEach(function(event) {
				var node = domPatch.find(path, root);

				if(node) {
					f(node, event);
				}
			});
		});
	}

	function findListTemplates(node) {
		var lists = Array.prototype.slice.call(node.querySelectorAll('[data-list]'));
		return lists.reduce(function (lists, list) {
			list.removeAttribute('data-list');
			list.parentNode.removeChild(list);
			lists[buildPath(list, node)] = list;
			return lists;
		}, {});
	}

	function diffDataAndDom(changes, shadow, root) {
		return changes.reduce(function (patch, path) {
			var value = jsonPointer.getValue(shadow, path);
			var node = domPatch.find(path, root);
			var nodeValue;

			if(!node) {
				patch.push({
					op: 'remove',
					path: path
				});
			} else {
				nodeValue = node && node[guessProp(node)];

				if (value !== nodeValue) {
					patch.push({
						op: 'replace',
						path: path,
						value: nodeValue
					});
				}
			}

			return patch;
		}, []);
	}

	function buildPath(start, end) {
		var segment, path = '';
		while(start && start !== end) {
			segment = start.getAttribute('name') || start.getAttribute('data-path');
			if(segment) {
				path = path ? (segment + '/' + path) : segment;
			}
			start = start.parentNode;
		}

		return path;
	}



});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));