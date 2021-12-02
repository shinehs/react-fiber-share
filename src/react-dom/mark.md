# 黄老师的大白话版本fiber是啥
> 这其实是我的学习笔记，所以比较口语化，原谅。
## fiber: 就是一个数据结构有很多属性

## fiber是啥呢
- 发展过程中 如果只用虚拟dom的话 有很多的事情做不到
- 很多真实dom做不到的事情 虚拟dom做不到
- 何况真实dom都做不到的事情 虚拟dom就更加做不到了
- 也就是说 单纯地使用虚拟dom 可以做到的事情是有限的
- 所以新的fiber数据结构 咱们给他添加了很多的属性
- 希望借由这些新的属性 来做到一些很有意思的事情


## fiber 架构是啥呢
- react在早期版本中 有一些遗憾的地方 或者说不足的地方
- 于是新版的react中 为了弥补这种不足的地方
- 设计了一些新的算法 用这些新的算法去做一些比较厉害的事情
- 这些新的算法的设计 就是架构
- 而为了能让这些算法跑起来 就有了fiber这种数据结构
- 就比如说 有了算法 但是你没有响应的数据结构 那就完不成这个算法
- 所以fiber的数据结构加上新的这套算法 就成了fiber架构


## react应用 从始至终 管理着最基本的三样东西
- 1. Root(整个应用的根儿 一个对象 不同于fiber 有属性指向current和workInProgress两颗树)
- 2. current树(树上的每一个节点都是fiber结构 保存着上该节点的上一个状态 并且每个fiber结构都对应着一个jsx节点)
- 3. workInProgress树(树上每个节点都是fiber 保存着本次更新的状态 并且每个fiber结构都对应着一个jsx节点)
- 每次更新 都会重新创建workInProgress树 然后 用这个workInProgress树来和current树作对比 之后进行更新
- 这三样东西 跟咱们自己传进的一点关系都没有


## 初次渲染时候 没有current也就是说没有上一次的状态
- react在一开始创建Root的同时 就会创建一个 uninitalFiber(未初始化的fiber)
- 并让Root的current 指向这个uninitalFiber
- 然后再去创建一个本次渲染要用到的workInProgress(RootFiber)
- 也就是说呢 初次渲染的时候 没有上一次状态 react内部会构建一个全部状态未初始化的fiber


## react中 主要有两个阶段
### render阶段
> 1. 为每个节点创建新的workInProgress(或复用) 生产一颗有新状态的fiber树
> 2. 初次渲染的时候(或新创建了某个节点的时候) 会为这个fiber创建真实的dom节点 并且对创建的dom节点的 节点进行插入append
> 3. 如果不是初次渲染的话 就对比新旧的fiber的状态 将产生了更新的fiber 最终通过链表的形式 挂载到RootFiber上

### commit阶段
> 1. 执行生命周期
> 2. 从RootFiber上 获取到有更新的fiber的那条链表 然后根据每个fiber的更新的状态(Update, Placment, Deletion, ...) 进行真正的修改页面

## setState是同步还是异步?
- 如果是正常情况下 也就是没有使用Concurrent组件到的情况下 react的更新是同步的
- 但是! 不会立即获取到最新的state的值 因为正常情况下 调用setState只是单纯的将你
- 传进来的新的状态 放入一条链表中 等这个事件执行完毕之后 会触发一个回调函数 这个函数中
- 才会真正地执行react的更新状态以及渲染的流程 并且 是以完全同步的方式进行的

- 当使用了Concurrent(react17中引入，18中成熟，但现在是beta版本预计是明年2月稳定)组件的时候 这种情况下 才是真正的异步更新模式
- 同样的 无法在事件中 立即获取到最新的状态 并且在执行react的更新和渲染的流程中
- 使用了真正的异步方式(postMessage) 这个才是真正的异步

``` javascript 
flushSync(() => {
  this.setState({
     ding: xxx
   })
 })
```
- 另外! 当时用了flushSync这个API的时候 这种情况下 就是完全同步的
- 就是说 一旦执行了flushSync 就会立即触发react的更新以及渲染的过程
- 这样的话 就可以在同一个事件函数中 立即获取到最新的状态了

``` javascirpt
 unstable_batchedUpdates // 17+
 setTimeout(() => {
   batchedUpdates(() => {
     this.setState({
       ding: xxx
     })
     this.setState({
       ding: yyy
     })
     console.log(this.state.ding) // 不能获取
   })
   console.log(this.state.ding) // 能获取
 })
```

- react之所以会更新 是因为state发生了变化
- 既然初次渲染的时候 是用uninitalFiber和新生成的workInProgress树做对比
- 那么可以理解成 uninitalFiber的state(是null)变成了咱们传进来的react元素


> 1. 判断当前节点上是否已经存在了effect链表 如果存在effect链表 说明 当前节点的子节点是有更新的 然后 要把当前节点上的effect链表 挂载到当前节点的父节点上


> 2. 判断当前节点 自己本身是否有更新(如果当前节点自身的effectTag !== NoWork)就把这个节点自己本身 也挂到父节点上


