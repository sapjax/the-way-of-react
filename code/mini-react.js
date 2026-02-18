/**
 * mini-react.js — The Way of React: Cumulative Engine
 * 
 * This file contains the complete Mini-React engine built across the book:
 * - Ch05: h(), mount(), patch() — Virtual DOM core
 * - Ch06: Component class, component support in mount/patch
 * - Ch07: setState, componentDidMount, componentWillUnmount
 * - Ch09: useState, useEffect, useRef, renderApp (Hooks)
 * - Ch10: createStore (Mini-Redux), createContext, useContext, useMemo
 * 
 * ⚠️ IMPORTANT: The class-based system (Ch06-07) and the Hooks system (Ch09)
 * are ALTERNATIVE approaches, not meant to be used simultaneously.
 * - mount() uses `new vnode.tag()` which works for class components but will
 *   crash with plain function components from Ch09.
 * - Ch09's demos use a separate, simplified mount/patch that strips out
 *   the class branch. See each chapter's HTML demo for self-contained versions.
 */

// ============================================
// Chapter 5: Virtual DOM Core
// ============================================

/** Create a virtual node */
function h(tag, props, children) {
  return { tag, props: props || {}, children: children || [] };
}

/** Mount a VNode to a real DOM container */
function mount(vnode, container) {
  // Text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    container.appendChild(document.createTextNode(vnode));
    return;
  }

  // Component nodes (Ch06)
  if (typeof vnode.tag === 'function') {
    const instance = new vnode.tag(vnode.props);
    vnode._instance = instance;
    const subTree = instance.render();
    instance._vnode = subTree;
    mount(subTree, container);
    vnode.el = subTree.el;
    // Lifecycle: componentDidMount (Ch07)
    if (instance.componentDidMount) {
      instance.componentDidMount();
    }
    return;
  }

  // HTML element nodes
  const el = (vnode.el = document.createElement(vnode.tag));

  // Props
  for (const key in vnode.props) {
    if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), vnode.props[key]);
    } else {
      el.setAttribute(key, vnode.props[key]);
    }
  }

  // Children
  if (typeof vnode.children === 'string') {
    el.textContent = vnode.children;
  } else {
    (vnode.children || []).forEach(child => {
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(child));
      } else {
        mount(child, el);
      }
    });
  }

  container.appendChild(el);
}

/** Diff and patch: update real DOM with minimal changes */
function patch(oldVNode, newVNode) {
  // Component nodes (Ch06)
  if (typeof newVNode.tag === 'function') {
    if (oldVNode.tag === newVNode.tag) {
      const instance = (newVNode._instance = oldVNode._instance);
      instance.props = newVNode.props;
      const oldSubTree = instance._vnode;
      const newSubTree = instance.render();
      instance._vnode = newSubTree;
      patch(oldSubTree, newSubTree);
      newVNode.el = newSubTree.el;
    } else {
      const parent = oldVNode.el.parentNode;
      mount(newVNode, parent);
      parent.replaceChild(newVNode.el, oldVNode.el);
    }
    return;
  }

  // Different tag types → replace
  if (oldVNode.tag !== newVNode.tag) {
    const parent = oldVNode.el.parentNode;
    const tmp = document.createElement('div');
    mount(newVNode, tmp);
    parent.replaceChild(newVNode.el, oldVNode.el);
    return;
  }

  // Same tag → update in place
  const el = (newVNode.el = oldVNode.el);
  const oldProps = oldVNode.props || {};
  const newProps = newVNode.props || {};

  // Update/add props
  for (const key in newProps) {
    if (oldProps[key] !== newProps[key]) {
      if (key.startsWith('on')) {
        const eventName = key.slice(2).toLowerCase();
        if (oldProps[key]) el.removeEventListener(eventName, oldProps[key]);
        el.addEventListener(eventName, newProps[key]);
      } else {
        el.setAttribute(key, newProps[key]);
      }
    }
  }

  // Remove old props
  for (const key in oldProps) {
    if (!(key in newProps)) {
      if (key.startsWith('on')) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // Children diffing
  const oldCh = oldVNode.children || [];
  const newCh = newVNode.children || [];

  if (typeof newCh === 'string') {
    if (oldCh !== newCh) el.textContent = newCh;
  } else if (typeof oldCh === 'string') {
    el.textContent = '';
    newCh.forEach(c => mount(c, el));
  } else {
    const commonLen = Math.min(oldCh.length, newCh.length);
    for (let i = 0; i < commonLen; i++) {
      const oc = oldCh[i], nc = newCh[i];
      if ((typeof oc === 'string' || typeof oc === 'number') &&
        (typeof nc === 'string' || typeof nc === 'number')) {
        if (oc !== nc) el.childNodes[i].textContent = nc;
      } else if (typeof oc === 'object' && typeof nc === 'object') {
        patch(oc, nc);
      } else {
        // Type changed
        if (typeof nc === 'string' || typeof nc === 'number') {
          el.replaceChild(document.createTextNode(nc), el.childNodes[i]);
        } else {
          const tmp = document.createElement('div');
          mount(nc, tmp);
          el.replaceChild(nc.el, el.childNodes[i]);
        }
      }
    }
    if (newCh.length > oldCh.length) {
      newCh.slice(oldCh.length).forEach(c => mount(c, el));
    }
    if (newCh.length < oldCh.length) {
      for (let i = oldCh.length - 1; i >= commonLen; i--) {
        el.removeChild(el.childNodes[i]);
      }
    }
  }
}


// ============================================
// Chapter 6-7: Component System
// ============================================

class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }

  setState(newState) {
    this.state = Object.assign({}, this.state, newState);
    this._update();
  }

  _update() {
    if (!this._vnode) return;
    const oldVNode = this._vnode;
    const newVNode = this.render();
    patch(oldVNode, newVNode);
    this._vnode = newVNode;
  }

  render() {
    throw new Error('Component must implement render()');
  }
}


// ============================================
// Chapter 9: Hooks
// ============================================

let _hooks = [];
let _hookIndex = 0;
let _currentRenderFn = null;
let _currentVNode = null;
let _currentContainer = null;

function useState(initialValue) {
  const idx = _hookIndex;
  if (_hooks[idx] === undefined) {
    _hooks[idx] = initialValue;
  }
  const setState = (newValue) => {
    _hooks[idx] = newValue;
    _rerender();
  };
  _hookIndex++;
  return [_hooks[idx], setState];
}

function useEffect(callback, deps) {
  const idx = _hookIndex;
  const prevDeps = _hooks[idx];
  let hasChanged = true;
  if (prevDeps) {
    hasChanged = deps
      ? deps.some((dep, i) => dep !== prevDeps[i])
      : true;
  }
  if (hasChanged) {
    if (_hooks[idx + 1]) _hooks[idx + 1](); // cleanup
    const cleanup = callback();
    _hooks[idx + 1] = cleanup;
  }
  _hooks[idx] = deps;
  _hookIndex += 2;
}

function useMemo(factory, deps) {
  const idx = _hookIndex;
  const prevDeps = _hooks[idx];
  let hasChanged = true;
  if (prevDeps) {
    hasChanged = deps.some((dep, i) => dep !== prevDeps[i]);
  }
  if (hasChanged) {
    _hooks[idx + 1] = factory();
  }
  _hooks[idx] = deps;
  _hookIndex += 2;
  return _hooks[idx + 1];
}

function useRef(initialValue) {
  // useRef is just a useMemo that returns a persistent mutable container.
  // The empty deps array [] ensures it's created once and never recalculated.
  return useMemo(() => ({ current: initialValue }), []);
}

function _rerender() {
  _hookIndex = 0;
  const newVNode = _currentRenderFn();
  if (_currentVNode) {
    patch(_currentVNode, newVNode);
  } else {
    mount(newVNode, _currentContainer);
  }
  _currentVNode = newVNode;
}

function renderApp(fn, container) {
  _currentRenderFn = fn;
  _currentContainer = container;
  _rerender();
}


// ============================================
// Chapter 10: State Management
// ============================================

/** Mini-Redux store */
function createStore(reducer, initialState) {
  let state = initialState;
  let listeners = [];

  return {
    getState: () => state,
    dispatch: (action) => {
      state = reducer(state, action);
      listeners.forEach(fn => fn());
    },
    subscribe: (fn) => {
      listeners.push(fn);
      return () => { listeners = listeners.filter(l => l !== fn); };
    }
  };
}

/** Simplified Context */
function createContext(defaultValue) {
  const context = {
    _value: defaultValue,
    _subscribers: [],
    Provider: (props) => {
      context._value = props.value;
      context._subscribers.forEach(fn => fn());
    }
  };
  return context;
}

function useContext(context) {
  return context._value;
}
