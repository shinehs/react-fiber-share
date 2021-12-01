
let NoWork = 0 // 表示没有更新
let Placement = 'Placement' // 表示要插入 react中的操作类型有很多，自己去源码看吧，这里只讲fiber的话只打算演示插入这一种情况
let Deletion = 'Deletion' // 表示要删除
let Update = 'Update' // 更新
let Callback = 'Callback' // 表示有回调
let PlacementAndUpdate = 'Placement|Update' // 表示又要插入又要更新 比如说某个dom属性变了同时还要和某个dom交换位置
let Snapshot = 'Snapshot' // 新周期

// react源码中是通过 ~ & | 这种位运算来对对effectTag进行标志的
// 比如
// effectTag = NoWork = 0b000
// Placement = 0b001
// Update = 0b010
// effectTag |= Placement
// => 0b001 
// effectTag |= Update
// => 0b011
// 这个不展开讲，自己看 

let isFirstRender = false // 表示初次渲染
let HostRoot = 'HostRoot' // RootFiber的类型 根fiber, 和FiberRoot要区分开来，FiierRoot +Node 就好理解了，他是个node
                          // FiberRoot.current = RootFiber
let ClassComponent = 'ClassComponent' // class组件类型
let HostComponent = 'HostComponent' // 原生节点类型
let HostText = 'HostText' // 文本类型
// 其他还有各种类型比如: HostPoratl ContextProvider ContextConsumer Fragment FunctionComponent

let nextFlushedRoot = null
let isRendering = false
let isWorking = false
let isCommitting = false
let nextUnitOfWork = null

// react事件系统 他把所有的合成事件代理到了根节点上
let eventsName = {
  onClick: 'click',
  onChange: 'change',
  onInput: 'input'
  // ...
}

let ifError = (function () {
  // 这个函数没用 就是怕while循环万一卡死了可以退出
  let _name = ''
  let _time = 0
  return function (name, time) {
    _name = _name !== name ? name : _name
    _time++
    if (_time >= time) {
      throw `${name}函数的执行次数超过了${time}次`
    }
  }
})()

function createFiber(tag, props, key) {
  return new FiberNode(tag, props, key)
}

class FiberNode {
  constructor(tag, pendingProps, key) {
    this.tag = tag // 表示fiber的类型
    this.key = key
    this.type = null // 表示当前fiber对应的节点的类型
    this.stateNode = null // 表示当前fiber对应的实例
    this.child = null // 指向当前fiber的firstChild
    this.sibling = null // 当前fiber的兄弟节点
    this.return = null // 指向当前fiber的父节点
    this.index = 0
    this.memoizedState = null // 表示当前fiber上的state
    this.memoizedProps = null // 表示旧的props的状态
    this.pendingProps = pendingProps // 表示即将挂载的props 或者说是本次更新的新的props
    this.effectTag = NoWork // 用来标识当前fiber要进行何种更新
    // effect应该从子节点一点点往上挂 就是说先挂子节点 再挂父节点
    // 比如说父节点删除了 但是子节点插入了 那这种情况就不能从上往下挂
    // 再比如说 ol是有序列表前面会显示序号 ul是无序列表前面会显示大圆点
    // 加入父节点想从ol变成ul 这样li就会从有序号变成大圆点
    // 但是假设需求是有序号我可以接受 但是我不能接受li前头有圆点
    // 于是在新一轮的更新中 我给每个li都加了去掉远点的属性
    // 这种情况下 如果我们从父节点开始更新的话 那么在ol变成ul的一瞬间
    // 由于我们还没有更新到子节点 所以子节点上还没有那个属性
    // 那这个时候就会有一瞬间看到前面的大圆点
    // 但是如果我们从子节点开始更新的话 子节点已经被赋予了那个属性
    // 之后再变ul 也不会有那一瞬间的闪现
    // 父节点是子节点的根儿 所以如果先变父节点 不一定会对子节点产生什么影响
    // 有一种牵一发而动全身的感觉
    this.firstEffect = null // 表示需要更新的第一个子节点
    this.lastEffect = null // 表示需要更新的最后一个子节点
    this.nextEffect = null // 表示下一个需要更新的子节点
    this.updateQueue = null // 也是条链表 上面保存着当前fiber的所有的更新状态
    // 这条链表是怎么传递到RootFiber上的呢
    // 是从子节点开始往父节点遍历
    // 如果某个节点本身有更新 就把这个节点作为它的父节点的lastEffect挂载到return上
    this.alternate = null // 用来连接current和workInProgress
    // ... 还有很多其他属性
    // expirationTime: 0
  }
}

function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate
  if (!workInProgress) {
    // 对于key值和type
    // setState中不一定会使用createWorkInProgress方法创建fiber
    // 可能用别的方法 别的方法中会对key有相应的处理 会直接用传进来的react元素的key来作比较
    // 对于type也是 如果key值或type不一样的话会直接使用createFiber创建新的fiber
    workInProgress = createFiber(current.tag, pendingProps, current.key)
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode
    // 要让这两个fiber相互指向
    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    workInProgress.pendingProps = pendingProps
    workInProgress.effectTag = NoWork
    workInProgress.nextEffect = null
    workInProgress.firstEffect = null
    workInProgress.lastEffect = null
  }
  // current.alternate和current上的updateQueue要保持同步

  // 因为在复用current.alternate的时候 这个alternate可能是最开始挂到组件实例上的fiber
  // 也可能不是 因为fiber一回是current一回是上一轮的workInProgres
  // 另外还因为每次setState传进来的更新是挂载在那个fiber上的
  // 所以就导致了本轮复用的workInProgress上的updateQueue可能会存在update
  // 也可能不会存在update 所以不存在update的时候说明fiber是current 这个时候就把
  // current(fiber)上的updateQueue复制过来

  // 然后保证queue1和queue2不是同一个引用还有个原因
  // 是如果用了suspense组件的话(或是一些意想不到的错误)
  // 后面在对workInProgress的updateQueue进行处理的时候
  // 处理完的结果可能会被弃用 所以就不能让俩指向同一个引用
  if (!!workInProgress &&
      !!workInProgress.updateQueue &&
      !workInProgress.updateQueue.lastUpdate) {
    // 在之后会对这个updateQueue进行克隆 保证我们不会操作到current上的状态
    workInProgress.updateQueue = current.updateQueue
  }
  // 这里的workInProgress.child 不能直接给null
  // 因为我们要操作的是workInProgress
  // 除了root的时候是传进来一个root.current
  // 剩下的调度子节点的时候 都要用workInProgress.child
  // 来进行调度
  // 在后面可能会大量用到current.child 但是每次都去
  // current下面拿child 就和我们想只操作workInProgress不一样了
  // 这个child在后面只是用来作为currentFirstChild来和newChild做对比的
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.sibling = current.sibling
  workInProgress.index = current.index
  return workInProgress
}

function reconcileSingleElement(returnFiber, element) {
  // 该函数的主要目的 就是要给当前的workInProgress的child创建fiber
  let type = element.type
  let flag = null
  if (element.$$typeof === Symbol.for('react.element')) {
    // 接下来要根据这个对象的类型来创建不同的fiber

    // 由于class组件都要继承自React.Component
    // 而这个React.Component上有个isReactComponent属性
    // 所以可以通过这个判断是不是class组件类型

    // 比如
    // class aaa {
    //   get isReact() {
    //     return true
    //   }
    // }
    // class bbb extends aaa {}
    // bbb.prototype 是 new aaa()
    if (typeof type === 'function') {
      if (type.prototype && type.prototype.isReactComponent) {
        flag = ClassComponent
      }
    } else if (typeof type === 'string') {
      flag = HostComponent
    }
    let fiber = createFiber(flag, element.props, element.key)
    fiber.type = type
    fiber.return = returnFiber
    return fiber
  }
}

function reconcileChildrenArray(workInProgress, nextChildren) {
  // 这个方法中 要通过index和key去尽可能多的找到可以复用的dom节点
  // 这个函数 在react源码中 就是最重要的diff算法
  let nowWorkInProgress = null
  if (isFirstRender) {
    nextChildren.forEach((reactEle, index) => {
      if (index === 0) {
        if (typeof reactEle === 'string' || typeof reactEle === 'number') {
          workInProgress.child = reconcileSingleTextNode(workInProgress, reactEle)
        } else {
          workInProgress.child = reconcileSingleElement(workInProgress, reactEle)
        }
        nowWorkInProgress = workInProgress.child
      } else {
        if (typeof reactEle === 'string' || typeof reactEle === 'number') {
          nowWorkInProgress.sibling = reconcileSingleTextNode(workInProgress, reactEle)
        } else {
          nowWorkInProgress.sibling = reconcileSingleElement(workInProgress, reactEle)
        }
        nowWorkInProgress = nowWorkInProgress.sibling
      }
    })
    return workInProgress.child
  } else {
    // 执行setState时候进到这里
  }
}

function reconcileSingleTextNode(returnFiber, text) {
  let createdFiber = createFiber(HostText, text, null)
  createdFiber.return = returnFiber
  return createdFiber
}

function reconcileChildFiber(workInProgress, nextChildren) {
  // 分类处理 因为传进来的nextChildren可能是单个子节点
  // 也有可能是一个数组
  // 还可能就是个文本类型
  if (nextChildren instanceof Object && !!nextChildren && !!nextChildren.$$typeof) {
    return reconcileSingleElement(workInProgress, nextChildren)
  }
  if (nextChildren instanceof Array) {
    return reconcileChildrenArray(workInProgress, nextChildren)
  }
  if (typeof nextChildren === 'string' || typeof nextChildren === 'number') {
    return reconcileSingleTextNode(workInProgress, String(nextChildren))
  }
  return null
}

function reconcileChildren(workInProgress, nextChildren) {
  // 如果workInProgress是RootFiber 并且是初次渲染的情况下
  // 初次渲染时候只需要在最外层的组件上挂一个Placement就好
  if (isFirstRender && !!workInProgress.alternate) {
    workInProgress.child = reconcileChildFiber(workInProgress, nextChildren)
    let effectTag = workInProgress.child.effectTag
    workInProgress.child.effectTag = effectTag ? `${effectTag}|${Placement}` : Placement
  } else {
    workInProgress.child = reconcileChildFiber(workInProgress, nextChildren)
  }
  return workInProgress.child
}

function updateHostRoot(workInProgress) {
  let children = workInProgress.memoizedState.element
  return reconcileChildren(workInProgress, children)
}

function updateClassComponent(workInProgress) {
  let component = workInProgress.type
  let nextProps = workInProgress.pendingProps
  if (!!component.defaultProps) {
    nextProps = Object.assign({}, component.defaultProps, nextProps)
  }
  let instance = workInProgress.stateNode
  let shouldUpdate = null
  if (!instance) {
    // 没有实例的话说明是第一次挂载 创建实例
    instance = new component(nextProps, null)
    workInProgress.memoizedState = instance.state
    workInProgress.stateNode = instance
    instance._reactInternalFiber = workInProgress
    instance.updater = classComponentUpdater

    // react中尽量少依赖外部数据源 就是说每次更新状态的时候尽量只靠组件自身内部的state
    // 而在componentWillReceiveProps里执行setState的话说明肯定是用了nextProps
    // 这样数据源就不唯一了

    let getDerivedStateFromProps = component.getDerivedStateFromProps
    if (!!getDerivedStateFromProps) {
      let newState = getDerivedStateFromProps(nextProps, workInProgress.memoizedState)
      if (!(newState === null || newState === undefined)) {
        workInProgress.memoizedState = Object.assign({}, nextProps, newState)
      }
      instance.state = workInProgress.memoizedState
    }
    let componentDidMount = instance.componentDidMount
    if (!!componentDidMount) {
      let effectTag = workInProgress.effectTag
      // debugger
      // 对于组件来说 Update表示有生命周期
      workInProgress.effectTag = effectTag ? `${effectTag}|${Update}` : Update
    }
    shouldUpdate = true
  } else {
    // 在setState时候如果组件写了snapshot方法的话 要给他一个标志
    // if (typeof instance.getSnapshotBeforeUpdate === 'function') {
    //   let effectTag = workInProgress.effectTag
    //   workInProgress.effectTag = effectTag ? `${effectTag}|${Snapshot}` : Snapshot
    // }
  }
  // if (!shouldUpdate) {}
  // 完成挂载class的阶段
  let nextChild = instance.render()
  return reconcileChildren(workInProgress, nextChild)
}

function updateHostComponent(workInProgress) {
  // 首先 一样的 要先拿到children
  let nextProps = workInProgress.pendingProps
  let nextChildren = nextProps.children

  // raect 中处理文本类型的节点的时候分情况
  // 一种情况是会直接对文本类型创建fiber的(当某个父节点有多个子节点的时候)
  // 另一种情况是不会对文本类型创建fiber 而是直接把文本类型的fiber置为null(当父节点有且只有一个文本类型的子节点的时候)
  // 如果是不创建fiber的这种情况 那么应该怎么将这个文本类型的节点添加到父节点下头呢
  // 在之后对这个父节点进行创建实例的时候 会把我们穿的props们作为属性一一赋值给该节点
  // 当然当判断到children这个属性的时候 如果这个children属性对应的是一个文本类型且是单独子元素的话
  // 会直接添加给父元素
  if (typeof nextChildren === 'string' || typeof nextChildren === 'number') {
    nextChildren = null
  }
  return reconcileChildren(workInProgress, nextChildren)
}

function beginWork(workInProgress) {
  console.log('开始创建fiber',workInProgress.pendingProps ? workInProgress.pendingProps.className :'RootFiber的类型-'+ workInProgress.tag)
  let next = null
  let tag = workInProgress.tag
  if (tag === HostRoot) {
    next = updateHostRoot(workInProgress)
  } else if (tag === HostComponent) {
    next = updateHostComponent(workInProgress)
  } else if (tag === ClassComponent) {
    next = updateClassComponent(workInProgress)
  } else if (tag === HostText) {
    next = null
  }
  return next
}

function completeWork(workInProgress) {
  // 初次渲染的流程
  // 首先创建对应的真实dom节点
  // 将当前dom节点的子节点 append到当前节点下
  // 将传进来的props赋值给当前节点

  // 更新时候的流程
  // 对比新旧两次的props 产生一个用于描述发生了什么变化的数组

  // 一般来说 几乎需要大量处理的 只有原生dom节点
  // 或文本节点 和suspense组件

  let tag = workInProgress.tag
  let instance = workInProgress.stateNode
  if (tag === HostComponent) {
    if (!instance) {
      // 如果没有实例的话 说明这个节点可能是
      // 第一次挂载 也就是初次渲染
      // 也不一定就是初次渲染 可能是一个新添加的节点
      
      // 首先创建实例
      let domElement = document.createElement(workInProgress.type)
      domElement.__reactInternalInstance = workInProgress
      workInProgress.stateNode = domElement

      // 把子节点添加到dom下
      let node = workInProgress.child
      wrapper: while (!!node) {
        let tag = node.tag
        if (tag === HostComponent || tag === HostText) {
          domElement.appendChild(node.stateNode)
        } else if (!!node.child) {
          // 可能不是原生的dom节点
          node.child.return = node
          node = node.child
          continue
        }

        // 到这步 说明找到了当前的父节点 说明子节点都添加完了
        if (node === workInProgress) break

        while (node.sibling === null) {
          if (node.return === null || node.return === workInProgress) {
            break wrapper
          }
          node = node.return
        }

        node.sibling.return = node.return
        node = node.sibling
      }

      // 把属性都添加到真实dom上
      let props = workInProgress.pendingProps
      for (let propKey in props) {
        let propValue = props[propKey]
        if (propKey === 'children') {
          if (typeof propValue === 'string' || typeof propValue === 'number') {
            domElement.textContent = propValue
          }
        } else if (propKey === 'style') {
          for (let stylePropKey in propValue) {
            if (!propValue.hasOwnProperty(stylePropKey)) continue
            let styleValue = propValue[stylePropKey].trim()
            if (stylePropKey === 'float') {
              stylePropKey = 'cssFloat'
            }
            domElement.style[stylePropKey] = styleValue
          }
        } else if (eventsName.hasOwnProperty(propKey)) {
          debugger
          let event = props[propKey]
          // react中 所有写在JSX模板上的事件 都是合成事件
          // 合成事件 是react中自己实现的一套事件系统
          // 加入有个onClick事件 当你点击这个元素的时候
          // react内部不会立即执行传进来的这个函数
          // 而是在执行这个函数之前 进行了很多的操作和处理
          // 比如说 会对事件回调接收的event进行处理
          // 比如说 内部他们自己实现了一个简单的阻止冒泡的方法
          // 在比如说 有一个很重要的一点
          // 就是react中 所有的合成事件都是被注册到了你挂载react应用的那个根节点上
          
          // 简单注册一下
          domElement.addEventListener(eventsName[propKey], event, false)
        } else {
          if(propKey === 'className') {
            domElement.setAttribute('class', propValue)
          } else {
            domElement.setAttribute(propKey, propValue)
          }
        }
      }
    } else {
      // 说明可能是执行setState时候进来的这里
      // 更新的时候会进行新旧属性的diff算法
      // 然后产生出一个描述该dom发生了什么变化的数组
      // 只产生 不赋值 赋值全都是在后面的commit过程中做的
    }
  } else if (tag === HostText) {
    // 因为文本几点是不会有子节点的
    // 所以无需执行插入子节点的操作
    let oldText = workInProgress.memoizedProps
    let newText = workInProgress.pendingProps
    if (!instance) {
      instance = document.createTextNode(newText)
      workInProgress.stateNode = instance
    } else {
      if (oldText !== newText) {
        // 这里要给这个文本类型的fiber一个Update的标识
        let effectTag = workInProgress.effectTag
        workInProgress.effectTag = effectTag ? `${effectTag}|Update` : 'Update'
      }
    }
  }
  console.log('完成创建', workInProgress.pendingProps ? workInProgress.pendingProps.className : 'RootFiber的类型-'  + workInProgress.tag)
}

function completeUnitOfWork(workInProgress) {
  // 首先肯定是个循环
  // 是一个循环找自己的兄弟节点或父节点的兄弟节点的过程
  // 如果父节点没有兄弟节点那么就直接再找父节点的父节点的兄弟节点
  while(true) {
    let returnFiber = workInProgress.return
    let siblingFiber = workInProgress.sibling
    // 这里还要对当前的这个workInProgress执行一些初始化或者插入子节点的操作
    // 因为这里是最佳的插入时机
    completeWork(workInProgress)
    // 第一步 先把当前节点上的有更新的子节点的fiber挂到父节点上
    if (!!returnFiber) {
      if (returnFiber.firstEffect === null) {
        // 说明当前的节点的父节点上 还没有挂任何的有更新的组件
        returnFiber.firstEffect = workInProgress.firstEffect
      }
      if (!!workInProgress.lastEffect) {
        if (!!returnFiber.lastEffect) {
          returnFiber.lastEffect.nextEffect = workInProgress.firstEffect
        }
        returnFiber.lastEffect = workInProgress.lastEffect
      }
    }

    // 第二步 判断当前节点自身是否有更新 如果有更新 就挂到当前节点的父节点的effect链表的最后一位
    let effectTag = workInProgress.effectTag
    let hasChange = (
      effectTag === Update ||
      effectTag === Deletion ||
      effectTag === Placement ||
      effectTag === PlacementAndUpdate
    )
    if (hasChange) {
      if (!!returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = workInProgress
      } else {
        returnFiber.firstEffect = workInProgress
      }
      returnFiber.lastEffect = workInProgress
    }
    // 对以上两个步骤不理解可以参考
    // https://github.com/y805939188/simple-react/tree/master/procedure/completeUnitOfWork



    if (!!siblingFiber) return siblingFiber
    if (!!returnFiber) {
      workInProgress = returnFiber
      continue
    }
    return null
  }
}


function performUnitWork(workInProgress) {
  let next = beginWork(workInProgress)
  if (next === null) {
    // 说明一侧节点已经遍历完成
    // 可以把完成一侧的节点 当成完成了一个单元的节点
    next = completeUnitOfWork(workInProgress)
  }
  return next
}

function workLoop(nextUnitOfWork) {
  while (!!nextUnitOfWork) {
    // 让performUnitOfWork返回下一个要工作的work
    nextUnitOfWork = performUnitWork(nextUnitOfWork)
  }
}

function commitRoot(root, finishedWork) {
  isWorking = true
  isCommitting = true

  // 获取到effect这条链表
  let firstEffect = finishedWork.firstEffect
  let nextEffect = null

  // 第一个循环主要用来调用getSnapshot那个生命周期
  // getSnapshotBeforeUpdate在React真正更新dom和ref之前
  // 所以可以用这个周期获取dom更新前的一些属性的值
  nextEffect = firstEffect
  while (!!nextEffect) {
    ifError('第一个while循环', 50)
    let effectTag = nextEffect.effectTag
    if (effectTag.includes(Snapshot)) {
      if (nextEffect.tag === ClassComponent) {
        let current = nextEffect.alternate
        let instance = nextEffect.stateNode
        let prevProps = Object.assign({}, nextEffect.type.defaultProps, current.memoizedProps)
        let prevState = Object.assign({}, current.memoizedState)
        let snapshot = instance.getSnapshotBeforeUpdate(prevProps, prevState) || {}
        instance.__reactInternalSnapshotBeforeUpdate = snapshot
      }
    }
    nextEffect = nextEffect.nextEffect
  }

  // 第二个循环主要用来操作有更新的fiber
  nextEffect = firstEffect
  while (!!nextEffect) {
    ifError('第二个while循环', 50)
    let effectTag = nextEffect.effectTag
    if (!effectTag) {
      nextEffect = nextEffect.nextEffect
      continue
    }
    if (effectTag.includes(Placement)) {
      // 先找到它的父节点 一个可以用来挂载的真实dom节点
      let parentFiber = nextEffect.return
      let parent = null
      while (!!parentFiber) {
        let tag = parentFiber.tag
        if (tag === HostComponent || tag === HostRoot) {
          break
        }
        parentFiber = parentFiber.returnFiber
      }
      if (parentFiber.tag === HostComponent) {
        parent = parentFiber.stateNode
      } else if (parentFiber.tag === HostRoot) {
        parent = parentFiber.stateNode.container
      }


      // 对下面这个循环不理解可以参考
      // https://github.com/y805939188/simple-react/tree/master/procedure/commitPlacement

      // 找到一个可以让当前这个新dom插在前面的dom节点
      // 就比如说
      // 更新前               更新后
      /*
        <div>                   <div>
          <h2></h2>               <h1></h1>
        </div>                    <h2></h2>
      |                         </div>
      更新后要新插如一个h1标签 而h1标签要插在h2标签之前
      这个h2 就是下面要找的before
      */
      let before = null
      // 第一种情况比较简单 就是当前节点是独生子的时候
      let node = nextEffect
      // 因为要不停地往右侧找一个可以被插入的真实dom
      // 所以肯定能想到是最外层要有个while循环
      // 然后在循环中写一定的规则找到这个dom然后跳出
      wrapper: while (true) {
        while (node.sibling === null) {
          // 如果没有兄弟节点的时候
          let returnFiber = node.return
          let tag = returnFiber.tag
          if (tag === HostComponent || tag === HostRoot) {
            // 进入这里说明父节点也没有兄弟节点
            // 并且父节点就是真实dom  那么可以直接append进这个父dom下
            break wrapper
          }
          node = node.return
        }

        node.sibling.return = node.return
        node = node.sibling

        // 要处理的就是当兄弟节点不等于原生dom或文本的时候
        // 因为后面可能有好多的新插入的节点
        // 所以这里要用while循环
        while (node.tag !== HostComponent && node.tag !== HostText) {
          if (node.effectTag.includes(Placement)) {
            continue wrapper
          }
          if (!node.child) {
            continue wrapper
          }
          node.child.return = node
          node = node.child
        }

        if (!node.effectTag.includes(Placement)) {
          before = node.stateNode
          break
        }
      }

      node = nextEffect
      // 因为当前节点可能子节点还是class组件
      // 所以要用while循环
      wrapper: while (true) {
        let childTag = node.tag
        // 因为只有原生dom类型或文本类型可以执行插入
        if (childTag === HostComponent || childTag === HostText) {
          // 执行插入操作
          if (!!before) {
            // 说明是独生子
            parent.insertBefore(node.stateNode, before)
          } else {
            parent.appendChild(node.stateNode)
          }
        } else if (!!node.child) {
          node.child.return = node
          node = node.child
          continue
        }

        // 由于classComponent可能返回数组 也就是当前节点有兄弟节点
        // 这些兄弟节点也需要插入到刚才那个before之前
        // 所以要让当前节点node指向兄弟节点进行下一轮插入
        while (!node.sibling) {
          if (!node.return || node.return === finishedWork) break wrapper
          node = node.return
        }
        node.sibling.return = node.return
        node = node.sibling
      }
    } else if (effectTag === Update) {
      // setState时候可能会进来
    } else if (effectTag === Deletion) {
      // setState进来
    } else if (effectTag === PlacementAndUpdate) {
      // setState时候可能进来
    }
    nextEffect = nextEffect.nextEffect
  }


  // 第三个循环主要用来执行剩下的生命周期
  nextEffect = firstEffect
  while (!!nextEffect) {
    ifError('第三个while循环', 50)
    let effectTag = nextEffect.effectTag
    // 当有生命周期方法的时候 会给当前组件一个Update
    // 当执行setState给回调的时候
    if (effectTag.includes(Update) || effectTag.includes(Callback)) {
      let tag = nextEffect.tag
      let instance = nextEffect.stateNode
      let current = nextEffect.alternate
      if (tag === ClassComponent) {
        // 当组件有Update时 说明组件上有生命周期方法
        if (effectTag.includes(Update)) {
          if (!!current) {
            let prevProps = current.memoizedProps
            let prevState = current.memoizedState
            instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate)
          } else {
            instance.componentDidMount()
          }
        }
        // 当effectTag是Callback的时候
        // 说明是setState上传了回调函数
      }
    }
    nextEffect = nextEffect.nextEffect
  }

  isWorking = false
  isCommitting = false
}

function completeRoot(root, finishedWork) {
  root.finishedWork = null
  commitRoot(root, finishedWork)
}

class ReactRoot {
  constructor(container) {
    this._internalRoot = this._createRoot(container)
  }
  _createRoot(container) {
    let uninitalFiber = this._createUninitalFiber(HostRoot, null, null)
    let root = {
      container: container,
      current: uninitalFiber,
      finishedWork: null
    }
    uninitalFiber.stateNode = root
    return root
  }
  _createUninitalFiber(HostRoot, props, key) {
    return createFiber(HostRoot, props, key)
  }
  render(element, callback) {
    let root = this._internalRoot
    // RootFiber的updateQueue比较特殊
    // 是ReactDOM.render传进来的第一个参数

    // 正常来讲 一个组件的updateQueue上保存的都是新的状态
    // 但是RactRoot比较特殊 它不是组件而是整个树的根儿
    // 所以要把传进来的这个element作为这个ReactRoot的新的state状态进行更新

    // 根据uninitalFiber生成workInProgress树
    // 至于什么时候用createWorkInProgress树呢
    // 就是当这个节点 有current的时候才会去用这个函数
    // 因为有current 所以可以尝试着去复用
    let workInProgress = createWorkInProgress(root.current, null)
    workInProgress.memoizedState = { element: element }
    // 其实react源码中是先把element临时挂到了current上 反正current也用不到
    // 这里直接一点简单一点 直接挂在memoizedState上
    nextUnitOfWork = workInProgress
    workLoop(nextUnitOfWork)
    root.finishedWork = root.current.alternate
    if (!!root.finishedWork) {
      completeRoot(root, root.finishedWork)
    }
  }
}

let classComponentUpdater = {
  enqueueSetState: function () {
    // 执行setState其实就是执行了这个方法
  }
}

let ReactDOM = {
  render: (reactEle, container, callback) => {
    isFirstRender = true
    let root = new ReactRoot(container)
    container._reactRootContainer = root
    root.render(reactEle, callback)
    isFirstRender = false
  },
}

export default ReactDOM
