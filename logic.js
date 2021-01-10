// initialize canvas vars
let canvas,
	ctx,
	frameWidth,
	frameHeight,
	lastPointColor,
	lastPointTTL = 0;

// constants
const BACKGROUND_RGB = '35, 35, 35',
	FONT_FAMILY = 'AmadorW01-Regular',
	// character size
	CHAR_RADIUS = 20,
	SWORD_LENGTH = 150,
	// physics
	THRUST = 1,
	FRICTION = .98,
	BOUNCE_COEF = .9,
	// to normalize diagonal acceleration
	DIAGONAL_MODIFIER = Math.sqrt(0.5);


class Character {
	constructor(xPortion, yPortion, color,
			upKeyCode, downKeyCode, leftKeyCode, rightKeyCode) {
		this.xPortion = xPortion;
		this.yPortion = yPortion;
		this.color = color;
		this.score = 0;
		// keypress management
		this.keyCodes = {
			up: upKeyCode,
			down: downKeyCode,
			left: leftKeyCode,
			right: rightKeyCode
		};
		this.keyStates = {
			up: false,
			down: false,
			left: false,
			right: false
		};
	}
	
	reset () {
		this.x = this.swordX = this.xPortion * frameWidth;
		this.y = this.swordY = this.yPortion * frameHeight;
		this.yv = this.xv = 0;
	}

	update () {
		this.xv *= FRICTION;
		this.yv *= FRICTION;

		// fix diagonal acceleration
		let adjustment = (this.keyStates.right + this.keyStates.left == 1) &&
			(this.keyStates.up + this.keyStates.down == 1) ? DIAGONAL_MODIFIER : 1;

		this.xv += (this.keyStates.right - this.keyStates.left) * adjustment * THRUST;
		this.yv += (this.keyStates.down - this.keyStates.up) * adjustment * THRUST;

		// // bouncing
		if (this.x <= CHAR_RADIUS) {
			this.xv = Math.abs(this.xv) * BOUNCE_COEF;
		} else if (this.x >= frameWidth - CHAR_RADIUS) {
			this.xv = Math.abs(this.xv) * -BOUNCE_COEF;
		}
		if (this.y <= CHAR_RADIUS) {
			this.yv = Math.abs(this.yv) * BOUNCE_COEF;
		} else if (this.y >= frameHeight - CHAR_RADIUS) {
			this.yv = Math.abs(this.yv) * -BOUNCE_COEF;
		}

		// wrap
		// bouncing
		// if (this.x <= CHAR_RADIUS) {
		// 	this.x += frameWidth;
		// } else if (this.x >= frameWidth - CHAR_RADIUS) {
		// 	this.x -= frameWidth;
		// }
		// if (this.y <= CHAR_RADIUS) {
		// 	this.y += frameHeight;
		// } else if (this.y >= frameHeight - CHAR_RADIUS) {
		// 	this.y -= frameHeight;
		// }

		this.x += this.xv;
		this.y += this.yv;

		let velocityMagnitude = Math.sqrt(this.xv * this.xv + this.yv * this.yv);
		this.swordX = this.x + this.xv / velocityMagnitude * SWORD_LENGTH;
		this.swordY = this.y + this.yv / velocityMagnitude * SWORD_LENGTH;
	};

	draw () {
		// draw character
		ctx.fillStyle = this.color;
		ctx.strokeStyle = this.color;
		ctx.lineWidth = 8;
		ctx.beginPath();
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.swordX, this.swordY);
		ctx.stroke();
		ctx.closePath();
		ctx.beginPath();
		ctx.arc(this.x, this.y, CHAR_RADIUS, 0, 2 * Math.PI);
		ctx.fill();
	}

	detectHit () {
		for (let char of chars) {
			if (this != char) {
				// projection of vector from this char to other char onto sword vector
				let vertDist = ((this.swordX - this.x) * (char.x - this.x) +
					(this.swordY - this.y) * (char.y - this.y)) / SWORD_LENGTH;
				// projection of vector from this char to other char onto normal of sword vector
				let horizDist = Math.abs((this.swordY - this.y) * (char.x - this.x) -
					(this.swordX - this.x) * (char.y - this.y)) / SWORD_LENGTH;

				// CHECK SLICE
				if (horizDist <= CHAR_RADIUS && 0 <= vertDist && vertDist <= SWORD_LENGTH ||
					// CHECK STAB
					(this.swordX - char.x) ** 2 + (this.swordY - char.y) ** 2 <= CHAR_RADIUS) {
					this.givePoint();
				}
			}
		}
	}

	givePoint () {
		console.log('point to ' + this.color);
		this.score++;
		// if (lastPointTTL == 80) {
			// lastPointColor = '#666666';
		// } else {
			lastPointColor = this.color;
			lastPointTTL = 80;
		// }
		console.log(lastPointColor);
	}
}

// characters
let chars = [new Character(1/4, 1/4, "#f9bd30", 87, 83, 65, 68),
	new Character(3/4, 1/4, "#fb4934", 38, 40, 37, 39),
	new Character(1/4, 3/4, "#fb4934", 38, 40, 37, 39),
];

function keySet(keyCode, state) {
	for (let char of chars) {
		for (let key in char.keyCodes) {
			if (keyCode == char.keyCodes[key]) {
				char.keyStates[key] = state;
			}
		}
	}
};

function step() {
	// draw background
	if (lastPointTTL) {
		if (lastPointTTL == 80) {
			resetScreen()
		}
		ctx.textAlign = "center";
		ctx.font = "200px " + FONT_FAMILY;
		ctx.fillStyle = lastPointColor;
		ctx.lineWidth = (81 - lastPointTTL) / 8;
		ctx.fillText("yeah!", frameWidth / 2, frameHeight / 2)
		lastPointTTL--;
	} else {
		ctx.fillStyle = `rgba(${BACKGROUND_RGB}, 0.6)`;
		ctx.fillRect(0, 0, frameWidth, frameHeight);
		for (let char of chars) {
			char.update();
			char.draw();
			char.detectHit();
		}
		drawScoreBoard();
	}
	window.requestAnimationFrame(step);
}

function resize() {
	frameHeight = window.innerHeight * window.devicePixelRatio;
	frameWidth = window.innerWidth * window.devicePixelRatio;

	canvas.height = frameHeight - 20;
	canvas.width = frameWidth - 20;
	for (char of chars) {
		char.x = Math.min(char.x, frameWidth - CHAR_RADIUS)
		char.y = Math.min(char.y, frameHeight - CHAR_RADIUS)
	}
}

function resetScreen() {
	ctx.fillStyle = "rgb(" + BACKGROUND_RGB + ")";
	ctx.fillRect(0, 0, frameWidth, frameHeight);
	for (let char of chars) {
		char.reset()
		char.draw()
	}
	drawScoreBoard();
}

function drawScoreBoard() {
	ctx.font = "120px " + FONT_FAMILY;
	// separator
	ctx.textAlign = "center";
	ctx.fillStyle = "#666";
	ctx.fillText("-", frameWidth / 2, 120)
	// first character
	ctx.textAlign = "right";
	ctx.fillStyle = chars[0].color;
	ctx.fillText(chars[0].score, frameWidth / 2 - 30, 120)
	// second character
	ctx.textAlign = "left";
	ctx.fillStyle = chars[1].color;
	ctx.fillText(chars[1].score, frameWidth / 2 + 30, 120)
}

window.onload = function() {
	canvas = document.getElementById("main-canvas");
	// const canvas = document.getElementById("main-canvas");
	
	window.addEventListener('resize', resize, false);
	ctx = canvas.getContext("2d");
	// set context settings
	ctx.strokeStyle = "#fff";
	ctx.lineWidth = 5;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	// ctx.globalCompositeOperation = "difference";
	
	resize();
	resetScreen()
	// begin animation
	window.requestAnimationFrame(step);
}
