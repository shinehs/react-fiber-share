import React from './react/react'
import ReactDOM from './react-dom/react-dom'

let ele = (
  <div className="parent">
    <div className="child1" style={{border: '4px solid green'}}>
      <div className="child1-A">A</div>
      <div className="child1-B">B</div>
    </div>
    <div className="child2" style={{border: '4px solid blue',marginTop:'10px'}}>
      <div className="C">C</div>
    </div>
  </div>
)
// console.log('~~~', ele);
ReactDOM.render(
  ele,
  document.querySelector('#root')
)
