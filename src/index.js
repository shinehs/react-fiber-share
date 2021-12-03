import React from './react/react'
import ReactDOM from './react-dom/react-dom'

let ele = (
  <div className="parent">
    <div className="child1" style={{border: '4px solid green'}}>
      <div className="child1-A">A</div>
      <div className="child1-B">B</div>
    </div>
    <div className="child2" style={{border: '4px solid blue',marginTop:'10px'}}>
      <div className="child2-C">C</div>
    </div>
  </div>
)
// console.log('~~~', ele);
debugger
// 其实react在render阶段就做了2件事情，
// 1.构建虚拟dom(不讲吧，投票的么~)
// 2.收集effectList(咱们调试下！)
ReactDOM.render(
  ele,
  document.querySelector('#root')
)
// 如果你拿17去玩 记得
// ReactDOM.unstable_createRoot(ocument.querySelector('#root')).render(ele)
