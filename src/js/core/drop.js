import $ from 'jquery';
import {hasTouch, isWithin, removeClass} from '../util/index';

export default function (UIkit) {

    var active, handler;

    UIkit.component('drop', {

        props: {
            mode: String,
            pos: String,
            offset: Number,
            justify: String,
            boundary: String,
            target: String,
            cls: String,
            flip: Boolean,
            delayShow: Number,
            delayHide: Number
        },

        defaults: {
            mode: 'hover',
            pos: 'bottom-left',
            offset: 0,
            justify: false,
            boundary: window,
            target: '.uk-drop',
            cls: 'uk-drop',
            flip: true,
            delayShow: 0,
            delayHide: 800,
            hoverIdle: 200
        },

        ready() {

            this.drop = this.$el.find(this.target);
            this.justify = this.justify && $(this.justify);

            if (this.justify) {
                this.flip = this.flip === true || this.flip === 'y' ? 'y' : false;
            }

            this.boundary = $(this.boundary);
            this.mode = hasTouch ? 'click' : this.mode;
            this.positions = [];

            // Init ARIA
            this.$el.attr({
                'aria-haspopup': 'true',
                'aria-expanded': this.$el.hasClass('uk-open')
            });

            if (!handler) {
                $('html').on('click', e => {
                    if (active && !active.$el.find(e.target).length) {
                        active.hide(true);
                    }
                });
            }

            this.$el.on('click', e => {
                if (!this.$el.hasClass('uk-open')) {
                    this.show(true);
                } else if (!isWithin(e.target, this.drop) || isWithin(e.target, `.${this.cls}-close`)) {
                    this.hide(true);
                }
            });

            if (this.mode === 'click') {
                this.$el.on('click', `:not(${this.target}) a[href="#"]`, e => {
                    e.preventDefault();
                });
            } else {
                this.$el.on('mouseenter', () => {
                    this.$el.trigger('pointerenter', [this]);
                    this.show();
                }).on('mouseleave', () => {
                    this.$el.trigger('pointerleave', [this]);
                    this.hide();
                });
            }

        },

        methods: {

            show(force) {

                this.clearTimers();

                if (active === this) {
                    return;
                } else if (!force && active && active !== this && active.isDelaying()) {
                    this.delayShowTimer = setTimeout(this.show.bind(this), 75);
                    return;
                } else if (active) {
                    active.hide(true);
                }

                this.$el.trigger('beforeshow', [this]);

                var show = () => {

                    this.updatePosition();

                    this.$el
                        .addClass('uk-open')
                        .attr('aria-expanded', 'true')
                        .trigger('show', [this]);

                    this.initMouseTracker();

                    this.$update();
                };

                if (!force && this.delayShow) {
                    this.delayShowTimer = setTimeout(show, this.delayShow);
                } else {
                    show();
                }

                active = this;
            },

            hide(force) {

                this.clearTimers();

                var hide = () => {
                    this.$el
                        .trigger('beforehide', [this, force])
                        .removeClass('uk-open')
                        .attr('aria-expanded', 'false')
                        .trigger('hide', [this, force]);

                    active = active === this ? null : active;
                    this.cancelMouseTracker();
                };

                if (!force && this.isDelaying()) {
                    this.hoverTimer = setTimeout(this.hide.bind(this), this.hoverIdle);
                } else if (!force && this.delayHide) {
                    this.delayHideTimer = setTimeout(hide, this.delayHide);
                } else {
                    hide();
                }
            },

            clearTimers() {

                if (this.delayShowTimer) {
                    clearTimeout(this.delayShowTimer);
                }

                if (this.delayHideTimer) {
                    clearTimeout(this.delayHideTimer);
                }

                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    delete this.hoverTimer;
                }
            },

            updatePosition() {

                // reset
                removeClass(this.drop, this.cls + '-(top|bottom|left|right|stack)').css({
                    'top-left': '',
                    'left': '',
                    'margin-left': '',
                    'margin-right': ''
                });

                if (this.justify) {
                    this.drop.css('min-width', '');
                }

                this.drop.show();

                var pos = getBoundary(this.$el),
                    dim = getBoundary(this.drop),
                    boundary = getBoundary(this.boundary),
                    dirAlign = this.pos.split('-');

                this.dir = dirAlign[0];
                this.align = dirAlign[1];

                if (dim.width > Math.max(boundary.right - pos.left, pos.right - boundary.left)) {

                    this.drop.addClass(this.cls + '-stack');
                    this.$el.trigger('stack', [this]);

                    dim = getBoundary(this.drop);
                }

                var positions = {
                        'bottom-left': {top: pos.height + this.offset, left: 0},
                        'bottom-right': {top: pos.height + this.offset, left: pos.width - dim.width},
                        'bottom-center': {top: pos.height + this.offset, left: (pos.width - dim.width) / 2},
                        'top-left': {top: -dim.height - this.offset, left: 0},
                        'top-right': {top: -dim.height - this.offset, left: pos.width - dim.width},
                        'top-center': {top: -dim.height - this.offset, left: (pos.width - dim.width) / 2},
                        'left-top': {top: 0, left: -dim.width - this.offset},
                        'left-bottom': {top: pos.height - dim.height, left: -dim.width - this.offset},
                        'left-center': {top: (pos.height - dim.height) / 2, left: -dim.width - this.offset},
                        'right-top': {top: 0, left: pos.width + this.offset},
                        'right-bottom': {top: pos.height - dim.height, left: pos.width + this.offset},
                        'right-center': {top: (pos.height - dim.height) / 2, left: pos.width + this.offset}
                    },
                    position = positions[this.pos];

                if (this.flip) {

                    var axis = this.getAxis(),
                        dir = flipAxis(pos, position, dim, boundary, axis);

                    if (dir && !flipAxis(pos, positions[`${dir}-${this.align}`], dim, boundary, axis)) {
                        this.dir = dir;
                    }

                    axis = axis === 'x' ? 'y' : 'x';
                    dir = flipPosition(flipAxis(pos, position, dim, boundary, axis));
                    if (dir && !flipAxis(pos, positions[`${this.dir}-${dir}`], dim, boundary, axis)) {
                        this.align = dir;
                    }

                    position = positions[`${this.dir}-${this.align}`]
                }

                if (this.justify) {

                    var justify = getBoundary(this.justify);

                    if (this.getAxis() === 'y') {
                        position.left = 0;
                        position['min-width'] = justify.width - (dim.width - this.drop.width());
                        position['margin-left'] = justify.left - pos.left;
                    } else {
                        position.top = 0;
                        position['min-height'] = justify.height - (dim.height - this.drop.height());
                        position['margin-top'] = justify.top - pos.top;
                    }
                }

                this.drop.css(position).css('display', '').addClass(`${this.cls}-${this.dir}`);
            },

            initMouseTracker() {

                this.positions = [];
                this.position = null;

                if (this.mode !== 'hover') {
                    return;
                }

                this.mouseHandler = (e) => {
                    this.positions.push({x: e.pageX, y: e.pageY});

                    if (this.positions.length > 3) {
                        this.positions.shift();
                    }
                };

                $(document).on('mousemove', this.mouseHandler);

                var offset = this.drop.offset(),
                    topLeft = {x: offset.left, y: offset.top},
                    topRight = {x: offset.left + this.drop.outerWidth(), y: topLeft.y},
                    bottomLeft = {x: offset.left, y: offset.top + this.drop.outerHeight()},
                    bottomRight = {x: topRight.x, y: bottomLeft.y};

                if (this.dir === 'left') {
                    this.incPoint = topRight;
                    this.decPoint = bottomRight;
                } else if (this.dir === 'right') {
                    this.incPoint = bottomLeft;
                    this.decPoint = topLeft;
                } else if (this.dir === 'bottom') {
                    this.incPoint = topLeft;
                    this.decPoint = topRight;
                } else if (this.dir === 'top') {
                    this.incPoint = bottomRight;
                    this.decPoint = bottomLeft;
                } else {
                    this.incPoint = 0;
                    this.decPoint = 0;
                }

            },

            cancelMouseTracker() {
                if (this.mouseHandler) {
                    $(document).off('mousemove', this.mouseHandler);
                }
            },

            isDelaying() {

                if (this.hoverTimer) {
                    return true;
                }

                var position = this.positions[this.positions.length - 1],
                    prevPos = this.positions[0] || position,
                    delay = !(
                        !position
                        || this.mode !== 'hover'
                        || !this.decPoint
                        || (this.position && position.x === this.position.x && position.y === this.position.y)
                        || slope(position, this.decPoint) > slope(prevPos, this.decPoint)
                        || slope(position, this.incPoint) < slope(prevPos, this.incPoint)
                    );

                this.position = delay ? position : null;
                return delay;
            },

            getAxis() {
                return this.dir === 'top' || this.dir === 'bottom' ? 'y' : 'x';
            }

        }

    });

    function flipPosition(pos) {
        switch(pos) {
            case 'left':
                return 'right';
            case 'right':
                return 'left';
            case 'top':
                return 'bottom';
            case 'bottom':
                return 'top';
            default:
                return pos;
        }
    }

    function flipAxis(pos, offset, dim, boundary, axis) {

        var left = pos.left + offset.left, top = pos.top + offset.top;

        return axis === 'x' && left < boundary.left
            ? 'right'
            : axis === 'x' && left + dim.width > boundary.right
                ? 'left'
                : axis === 'y' && top < boundary.top
                    ? 'bottom'
                    : axis === 'y' && top + dim.height > boundary.bottom
                        ? 'top'
                        : false;
    }

    function getBoundary(boundary) {
        var width = boundary.outerWidth(),
            height = boundary.outerHeight(),
            offset = boundary.offset(),
            left = offset ? offset.left : boundary.scrollLeft(),
            top = offset ? offset.top : boundary.scrollTop();

        return {width: width, height: height, left: left, top: top, right: left + width, bottom: top + height};
    }


    function slope(a, b) {
        return (b.y - a.y) / (b.x - a.x);
    }
}
