// @flow

export default class ResizeObserver2 {
  cb: Function
  constructor (cb: Function) {
    this.cb = cb
  }

  observe (el: HTMLElement) {
    // build the listeners
    const expand = document.createElement('_')
  	const shrink = expand.appendChild(document.createElement('_'))
  	const expandChild = expand.appendChild(document.createElement('_'))
  	const shrinkChild = shrink.appendChild(document.createElement('_'))
    shrink.style.cssText = expand.style.cssText = 'display:block;height:100%;left:0;opacity:0;overflow:hidden;pointer-events:none;position:absolute;top:0;transition:0s;width:100%;z-index:-1';
  	shrinkChild.style.cssText = expandChild.style.cssText = 'display:block;height:100%;transition:0s;width:100%';
  	shrinkChild.style.width = shrinkChild.style.height = '200%';

    el.appendChild(expand)

    shrink.addEventListener('transitionend', () => { console.log('SHRINK') })
		expand.addEventListener('transitionend', () => { console.log('EXPAND') })
  }
}
