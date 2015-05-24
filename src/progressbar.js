/*
 dom connection classes:
 .-pb-progress // dom item being used as an indicator. width is changed
 */
$.fn.progressBar = function(todo)
{
	/*** plugin parameters ***/
	var self = {
		pcode: 'progressBar',
		options:
		{
			interactive: true, // if true, user is able to change bar value with mouse click, wheel or touch and move
			useWheel: true, // if true and interactive == true, then bar value can be changed by mouse wheel turn
			top: 100, // supremum limit (100%)
			step: 1, // grid step
			initial: false, // initial value, integer BUG: NOT working
			eventExtArea: false,
			smoothBar: false, // if true, bar width will be changed smmothly, not discreetly
			animationDuration: 200,

			onValueChange: function(newVal){}, // fires on any value change
			onValueChangeByUser: function(newVal){}, // fires on value change caused by user
			onTrackBarChange: function(tempVal, pos){}, // fires on bar change
			onDragStart: function(){}, // fires when user starts bar drag
			onDragEnd: function(){}, // fires when user stops bar drag
			onTrackBarChangeAnimationStep: function(){}
		}
	};

	/*** methods standard ***/
	self.init = function(options)
	{
		//var common = {};
		var opts = $.extend(self.options, options);
		return this.each(function()
		{

			var $this = $(this);

			// already initialized at that element
			if(typeof($this.data(self.pcode)) != 'undefined')
				return;

			//////////////////////////////////////////////////////////
			///////////////

			// on each plugin call self will be THE OTHER object, so no data attach to self, use $(...).data(...) instead
			var data = {
				dom: $this,
				ctrls: { // stored controls
				},
				vars: { // internal variables
					value: 0, // current progress value (could be any integer from range [0. data.opts.top])
					stepped: 0, // same as value, but adjusted along grid, if data.opts.step > 1
					//width: $this.width(), // when resize, recalc this
					offset: Math.floor($this.offset().left), // and this
					followMouse: false, // flag, switched to true, if mousedown raised at element. it controls drag
					followWheel: false, // flag, switched to true when mouseover occured and back to false when mouseout. it controls mouse wheel
					notClick: false // flag, switched to true, if there was mousemove between mousedown and mouseup 
				},
				/*
				tmpls: {},
				sdata: common, // shared data for all elements in a jquery set
				*/
				opts: $.extend({}, opts) // plugin options
			}
			
			// further init below
			//$this.css('position', 'relative');
			data.ctrls.bar = $('.-pb-progress', $this);//.css({position: 'absolute', left: 0});
			//data.vars.k = data.vars.width / data.opts.top;

			if(data.opts.interactive)
			{
				var muCb = function()
				{
					if(data.vars.followMouse)
					{
						if(!data.vars.notClick) 
						{
							self._processMouse.call(data); // simple click (i.e. there was no mousemove between mousedown and mouseup)
						}

						data.vars.value = data.vars.tempValue;
						data.vars.notClick = data.vars.followMouse = false;
						
						data.opts.onValueChange.apply(data, [data.vars.value]);
						data.opts.onValueChangeByUser.apply(data, [data.vars.value]);
						data.opts.onDragEnd.apply(data, [data.vars.value]);
					}
				}
				var mmCb = function(e)
				{
					e = e || window.event;

					data.vars.mouse = e.pageX ? e.pageX :(e.clientX ? e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft) - document.documentElement.clientLeft : 0);

					if(data.vars.followMouse)
					{
						data.vars.notClick = true;
						self._processMouse.call(data);
					}
				};
				var mdCb = function()
				{
					data.vars.followMouse = true;
					data.opts.onDragStart.apply(data, [data.vars.value]);
				}
			
				$(document).bind('mousemove.'+self.pcode, mmCb)
					.bind('touchmove.'+self.pcode, function(e){
						mmCb({
							clientX: e.originalEvent.changedTouches[0].clientX
						});
					})
					.bind('mouseup.'+self.pcode, muCb)
					.bind('touchend.'+self.pcode, muCb);

				var area = $this;
				var aarea = false;
				if((aarea = $(data.opts.eventExtArea)).length == 1)
					area = aarea;
				
				area.bind('mousedown'/*.'+self.pcode*/, mdCb);
				area.bind('touchstart.'+self.pcode, mdCb);
				
				if(data.opts.useWheel)
				{
					area.bind('mouseover.'+self.pcode, function(){
						data.vars.followWheel = true;
					}).bind('mouseout.'+self.pcode, function(){
						data.vars.followWheel = false;
					}).bind('mousewheel.'+self.pcode, function(e, delta){
						// here $.throttle() required in case of smoothBar == true
						if(data.vars.followWheel)
						{
							e = e.originalEvent || window.event;
							var delta = 0;
							if(e.wheelDelta)
							{
								delta = event.wheelDelta / 120;
								if (window.opera) delta = -delta;
							}
							else if (event.detail)
							{
								delta = -event.detail / 3;
							}

							if(self._setValue.apply(data, [data.vars.stepped + delta*data.opts.step, true]))
								data.opts.onValueChangeByUser.apply(data, [data.vars.value]);

							return false;
						}
					});
				}
			}
			if(data.opts.initial !== false)
			{
				self._setValue.apply(data, [+data.opts.initial]);
			}
			
			///////////////
			//////////////////////////////////////////////////////////
			$this.data(self.pcode, data);
		});
	}
	
	/*** methods public ***/
	// get value of the first element of jquery node set
	self.getValue = function(getStepped)
	{
		var frst = this.eq(0).data(self.pcode).vars;
		return getStepped ? frst.stepped : frst.value;
	}
	// set progress indicator position between [0, data.opts.top]
	self.setValue = function(progress)
	{
		return this.each(function(){

			var data = $(this).data(self.pcode);

			if(typeof data == 'undefined')
				return;

			self._setValue.apply(data, [progress]);
		});
	}
	
	self.option = function(opt, val)
	{
		if(typeof(val) == 'undefined') // assume only one element
		{
			return this.eq(0).data(self.pcode)[opt];
		}
		else
		{
			return this.each(function(){
				var data = $(this).data(self.pcode);
				if(typeof(data) == 'object')
					data.opts[opt] = val;
			});
		}
	}

	// takes current bar with and returns value matched to it
	self.barWidthToValue = function(width)
	{
		if(typeof this.eq(0) == 'undefined')
			return null;

		var frst = this.eq(0).data(self.pcode); // only first element in a set served

		if(typeof width == 'undefined')
			width = frst.ctrls.bar.width();

		return width / frst.dom.width() * frst.opts.top;
	}

	/*** methods private ***/
	// translate backward: mouse coords => progressbar position => value
	self._processMouse = function()
	{
		var w = this.dom.width();
		var pos = this.vars.mouse - this.vars.offset;

		if(pos < 0) pos = 0;
		if(pos > w) pos = w;

		this.vars.tempValue = Math.floor(pos / w * this.opts.top);
		pos = Math.floor(pos);

		// this value should be adjusted along the grid (if any)
		if(this.opts.step > 1 && pos > 0)
		{
			var tVal = this.vars.tempValue;
			var steppedTVal = tVal - (tVal % this.opts.step);

			if(steppedTVal < this.opts.top)
				steppedTVal += this.opts.step;

			//console.dir('pos: '+pos+' tVal: '+tVal+' stVal: '+steppedTVal+' stepped (now): '+this.vars.stepped);

			if(steppedTVal == this.vars.stepped)
				return;

			else this.vars.stepped = steppedTVal;

			// now we got corrected steppedTVal which we use to get bar position
			pos = self._map.apply(this, [steppedTVal]);
		}
		else
		{
			this.vars.stepped = this.vars.tempValue;
		}

		this.ctrls.bar.css('width', pos+'px');
		this.opts.onTrackBarChange.apply(this, [this.vars.tempValue, pos]);
	}
	// translate forward: value => progressbar position
	self._setValue = function(progress, strict)
	{
		var top = this.opts.top;

		progress = +progress;
		if(strict && (progress < 0 || progress > top)) 
			return; // exact interval match

		if(progress < 0) 
			progress += top; // negative values bring back to the interval

		if(progress > top)
			progress %= top; // too high values also

		var fin = function(progress)
		{
			this.vars.value = progress;
			this.opts.onValueChange.apply(this, [this.vars.value]);
		}

		// ajust along the grid
		if(this.opts.step > 1){
			var stepped = progress - (progress % this.opts.step);
			if(stepped == this.vars.stepped)
			{
				fin.apply(this, [progress]);
				return;
			}
			else
			{
				this.vars.stepped = stepped;
			}
		}
		else
		{
			this.vars.stepped = progress;
		}
		
		// now map progress range to the progressbar width
		var mappedProgress = self._map.apply(this, [progress]);

		if(this.vars.value != mappedProgress)
		{
			if(this.opts.smoothBar)
			{
				this.ctrls.bar.animate(
					{
						width: mappedProgress+'px'
					},
					{
						progress: $.proxy(this.opts.onTrackBarChangeAnimationStep, this),
						duration: this.opts.animationDuration
					}
				);
			}
			else
			{
				this.ctrls.bar.css('width', mappedProgress+'px');
			}

			fin.apply(this, [progress]);
			this.opts.onTrackBarChange.apply(this, [this.vars.value, mappedProgress]);
		}

		return true;
	}
	self._map = function(value)
	{
		var mapped = Math.round(value * this.dom.width() / this.opts.top);
		if(mapped > this.vars.top)
			mapped = this.vars.top;

		return mapped;
	}
	
	// todo
	if(typeof(todo) == 'string' && todo[0] != '_' && typeof(self[todo]) == 'function') // todo is a method, call it
	{
		return self[todo].apply(this, Array.prototype.slice.call(arguments, 1));
	}
	else if(typeof(todo) === 'object' || typeof(todo) == 'undefined') // todo is an option object, to init() in it
	{
		return self.init.apply(this, arguments);
	}
}