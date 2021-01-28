/**
 * 单一属性动画类
 */
class Clip {
	constructor(options) {
		if (typeof options != 'object' || !options) {
			options = {}
		}
		this.style = options.style; //样式名称
		this.value = options.value; //样式最终值
		this.speed = options.speed; //动画速度，即每次样式改变的量
		this.unit = null; //样式单位，无单位则为null
		this.requestAnimationFrame = null;
		this.status = 0; //0表示动画初始状态，1表示动画进行状态，2表示动画停止状态，3表示动画完成状态
		this.$parent = null; //animator实例
		this.$initValue = null; //属性值初始值
		this.$events = []; //自定义事件数组
		this._init();
	}

	/**
	 * 初始化参数
	 */
	_init() {
		//参数初始化
		if (typeof this.style != 'string' || !this.style) {
			throw new Error('style is not defined')
		}
		if (typeof this.value == 'number') {
			this.unit = null;
		} else if (typeof this.value == 'string') {
			if (this.value.endsWith('px')) {
				this.unit = 'px';
			} else if (this.value.endsWith('rem')) {
				this.unit = 'rem';
			}else {
				throw new Error('currently, only attribute values for px and rem units are supported')
			}
			this.value = parseFloat(this.value);
		} else {
			if (!this.value) {
				throw new Error('value is not defined')
			} else {
				throw new TypeError('value is should be a number or a string')
			}
		}
		if (typeof this.speed != 'number') {
			this.speed = 0;
		}

		//动画函数初始化
		this.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
		if (!this.requestAnimationFrame) {
			throw new ReferenceError('browser does not support requestAnimationFrame');
		}

		//事件数组初始化
		this.$events = [
			//动画开始事件
			{
				name: 'start',
				handler: function() {}
			},
			//动画结束事件
			{
				name: 'complete',
				handler: function() {}
			},
			//动画更新事件
			{
				name: 'update',
				handler: function() {}
			},
			//动画停止事件
			{
				name: 'stop',
				handler: function() {}
			},
			//动画重置事件
			{
				name: 'reset',
				handler: function() {}
			}
		]
	}

	/**
	 * 执行动画
	 */
	start() {
		if (!this.$parent || !this.$parent.$el) {
			throw new ReferenceError('Clip instance shoud be added to the Animator instance')
		}
		//获取初始属性值
		let oldValue = parseFloat(this._getCssStyle(this.style));
		//如果属性为渐增的且属性值已经超过目标属性值大小，则不进行动画
		if (this.speed > 0 && oldValue >= this.value) {
			return;
		}
		//如果属性为渐少的且属性值已经达到目标属性值大小，则不进行动画
		if (this.speed < 0 && oldValue <= this.value) {
			return;
		}
		//如果已经是进行状态或者完成状态，则不进行动画
		if (this.status == 1 || this.status == 3) {
			return;
		}
		//更改帧状态
		this.status = 1;
		//clip触发start事件
		this._emit('start');
		//动画帧执行函数
		let doFun = () => {
			//每一帧运行时判断是否处在运行状态
			if (this.status != 1) {
				return;
			}
			//每一帧运行时判断是否达到目标属性值
			let initValue = parseFloat(this._getCssStyle(this.style));
			if (this.speed > 0 && initValue >= this.value) {
				return;
			}
			if (this.speed < 0 && initValue <= this.value) {
				return;
			}
			//设置样式
			this.$parent.$el.style.setProperty(this.style, (initValue + this.speed) + this.unit, 'important');
			//获取新的属性值
			let newValue = parseFloat(this._getCssStyle(this.style));
			//clip触发update事件
			this._emit('update', [this.style, newValue])
			//animator触发update事件
			this.$parent.$options.update.apply(this.$parent, [this, this.style, newValue])
			if (this.speed > 0 && newValue < this.value) {
				this.requestAnimationFrame.call(window, doFun)
			} else if (this.speed < 0 && newValue > this.value) {
				this.requestAnimationFrame.call(window, doFun)
			} else {
				//动画运行结束，修改状态
				this.status = 3;
				//clip触发complete事件
				this._emit('complete');
				//动画全部结束
				if (this.$parent.getClips().length == 0) {
					//animator触发complete事件
					this.$parent.$options.complete.call(this.$parent)
				}
			}
		}
		this.requestAnimationFrame.call(window, doFun)
	}

	/**
	 * 停止动画
	 */
	stop() {
		if (!this.$parent || !this.$parent.$el) {
			throw new ReferenceError('Clip instance shoud be added to the Animator instance')
		}
		//非运行状态的动画帧无法停止
		if (this.status != 1) {
			return;
		}
		//修改状态
		this.status = 2;
		//clip触发stop事件
		this._emit('stop')
	}

	/**
	 * 重置动画
	 */
	reset() {
		if (!this.$parent || !this.$parent.$el) {
			throw new ReferenceError('Clip instance shoud be added to the Animator instance')
		}
		//初始状态的动画帧无需重置
		if (this.status == 0) {
			return;
		}
		//修改状态
		this.status = 0;
		//恢复初始属性值
		this.$parent.$el.style.setProperty(this.style, this.$initValue, 'important');
		//clip触发reset事件
		this._emit('reset')
	}

	/**
	 * 自定义事件执行
	 */
	on(eventName, handler) {
		let event = this._getEvent(eventName);
		if (event) {
			event.handler = handler;
		} else {
			throw new Error(eventName + ' is an illegal event')
		}
	}

	/**
	 * 触发自定义事件
	 */
	_emit(eventName, params) {
		let event = this._getEvent(eventName);
		if (event) {
			if (params) {
				event.handler.call(this, this.$parent.$el, ...params);
			} else {
				event.handler.call(this, this.$parent.$el);
			}
		}
	}

	/**
	 * 获取事件数组中指定事件
	 */
	_getEvent(eventName) {
		let event = null;
		let length = this.$events.length;
		for (let i = 0; i < length; i++) {
			if (this.$events[i].name == eventName) {
				event = this.$events[i];
				break;
			}
		}
		return event;
	}

	/**
	 * 获取元素指定样式
	 * cssName:样式名称,css名称
	 */
	_getCssStyle(cssName) {
		if (typeof cssName == "string") {
			let cssText = "";
			if (document.defaultView && document.defaultView.getComputedStyle) { //兼容IE9-IE11、chrome、firefox、safari、opera；不兼容IE7-IE8
				cssText = document.defaultView.getComputedStyle(this.$parent.$el)[cssName];
			} else { //兼容IE7-IE11；不兼容chrome、firefox、safari、opera
				cssText = this.$parent.$el.currentStyle[cssName];
			}
			return cssText;
		} else {
			return null;
		}
	}
}

module.exports = Clip