
const REACT_ELEMENT_TYPE = Symbol.for('react.element')

function ReactElement(type, key, props) {
  let element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type, // type: 'div' or other html tag
    key,
    props
  }
  return element
}

function createElement(type, props = {}, children) {
  let _props = Object.assign({}, props)
  let _key = _props.key || null
  let children_length = children.length
  _props.children = children_length === 0 ? null : children_length === 1 ? children[0] : children
  return ReactElement(type, _key, _props)
}

class Component {
  constructor(props, context, updater) {
    this.props = props
    this.context = context
    this.updater = updater || null
  }
  get isReactComponent() {
    return true
  }
  setState(partialState, callback) {
    if (partialState instanceof Object || typeof partialState === 'function') {
      let _setState = this.updater.enqueueSetState
      _setState && _setState(this, partialState, callback, 'setState')
    }
  }
}

const React = {
  createElement: function(type, props, ...children) {
    let element = createElement(type, props, children)
    return element
  },
  Component
}

export default React