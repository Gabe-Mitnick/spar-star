// initialize canvas vars
let canvases = {},
	c = {},
	frameWidth,
	frameHeight,
	lastPointColor,
	lastPointTTL = 0;

// constants
const BACKGROUND_COLOR = "#232323",
	NEUTRAL_COLOR = "#666666",
	FONT_FAMILY = "Balsamiq Sans",
	// character size
	RADIUS = 20,
	SWORD_LENGTH = 160,
	SWORD_WIDTH = 10,
	COLLISION_RADIUS = RADIUS + SWORD_WIDTH / 2,
	// physics
	THRUST = 1,
	FRICTION = 0.98,
	BOUNCE_COEF = 0.9,
	// to normalize diagonal acceleration
	ROOT_2 = Math.sqrt(0.5),
	// 0.002
	POWER_UP_PROBABILITY = 0.002;

window.onload = function () {
	// find all canvas elements and create contexts
	for (const layerName of ["main", "score", "msg"]) {
		canvases[layerName] = document.getElementById(layerName + "-canvas");
		c[layerName] = canvases[layerName].getContext("2d");
	}
	// reset frame size and character positions
	resize();
	resetScreen();
	window.addEventListener("resize", resize, false);
	// begin animation
	window.requestAnimationFrame(step);
};

class Character {
	constructor(xPortion, yPortion, color, upKeyCode, downKeyCode, leftKeyCode, rightKeyCode) {
		this.xPortion = xPortion;
		this.yPortion = yPortion;
		this.color = color;
		this.score = 0;
		// keypress management
		this.keyCodes = {
			up: upKeyCode,
			down: downKeyCode,
			left: leftKeyCode,
			right: rightKeyCode,
		};
		this.keyStates = {
			up: false,
			down: false,
			left: false,
			right: false,
		};
	}

	reset() {
		this.swordLength = SWORD_LENGTH;
		this.thrust = THRUST;
		this.wrap = false;
		this.x = this.xPortion * frameWidth;
		this.y = this.yPortion * frameHeight;
		this.yv = this.xv = 0;
		this.swordX = this.x;
		this.swordY = this.y;
	}

	update() {
		this.xv *= FRICTION;
		this.yv *= FRICTION;

		// fix diagonal acceleration
		let adjustment =
			this.keyStates.right != this.keyStates.left && this.keyStates.up != this.keyStates.down ? ROOT_2 : 1;

		this.xv += (this.keyStates.right - this.keyStates.left) * adjustment * this.thrust;
		this.yv += (this.keyStates.down - this.keyStates.up) * adjustment * this.thrust;

		if (this.wrap) {
			// wrap around walls
			if (this.x <= RADIUS) {
				this.x += frameWidth;
			} else if (this.x >= frameWidth - RADIUS) {
				this.x -= frameWidth;
			}
			if (this.y <= RADIUS) {
				this.y += frameHeight;
			} else if (this.y >= frameHeight - RADIUS) {
				this.y -= frameHeight;
			}
		} else {
			// bounce off walls
			if (this.x <= RADIUS) {
				this.xv = Math.abs(this.xv) * BOUNCE_COEF;
			} else if (this.x >= frameWidth - RADIUS) {
				this.xv = Math.abs(this.xv) * -BOUNCE_COEF;
			}
			if (this.y <= RADIUS) {
				this.yv = Math.abs(this.yv) * BOUNCE_COEF;
			} else if (this.y >= frameHeight - RADIUS) {
				this.yv = Math.abs(this.yv) * -BOUNCE_COEF;
			}
		}

		// apply velocity
		this.x += this.xv;
		this.y += this.yv;
		// calculate sword position
		let velocityMagnitude = Math.sqrt(this.xv * this.xv + this.yv * this.yv);
		this.swordX = this.x + (this.xv / velocityMagnitude) * this.swordLength;
		this.swordY = this.y + (this.yv / velocityMagnitude) * this.swordLength;
	}

	draw() {
		// draw character
		c.main.fillStyle = this.color;
		c.main.strokeStyle = this.color;
		c.main.lineWidth = SWORD_WIDTH;
		c.main.beginPath();
		c.main.moveTo(this.x, this.y);
		c.main.lineTo(this.swordX, this.swordY);
		c.main.stroke();
		c.main.beginPath();
		c.main.arc(this.x, this.y, RADIUS, 0, 2 * Math.PI);
		c.main.fill();
	}

	detectHits() {
		// see if "this" has hit another char
		for (const otherChar of chars) {
			if (this !== otherChar && this.isTouching(otherChar)) {
				this.givePoint();
			}
		}
		// traditional indexed for loop to accommodate removing items
		for (let i = powerUps.length - 1; i >= 0; i--) {
			if (this.isTouching(powerUps[i])) {
				powerUps[i].applyEffect(this);
				powerUps.splice(i, 1);
			}
		}
	}
	// other can be a char or a powerup; just needs an x and y
	isTouching(other) {
		// projection of vector from this to other onto sword vector
		let vertDist =
			((this.swordX - this.x) * (other.x - this.x) + (this.swordY - this.y) * (other.y - this.y)) /
			this.swordLength;
		// projection of vector from this to other onto normal of sword vector
		let horizDist =
			Math.abs((this.swordY - this.y) * (other.x - this.x) - (this.swordX - this.x) * (other.y - this.y)) /
			this.swordLength;

		let slice = horizDist <= COLLISION_RADIUS && 0 <= vertDist && vertDist <= this.swordLength;
		let stab = (this.swordX - other.x) ** 2 + (this.swordY - other.y) ** 2 <= COLLISION_RADIUS;
		return slice || stab;
	}

	givePoint() {
		this.draw();
		this.score++;
		if (lastPointTTL == 80) {
			lastPointColor = NEUTRAL_COLOR;
		} else {
			lastPointColor = this.color;
			lastPointTTL = 80;
		}
	}
}

// characters
let chars = [
	new Character(1 / 4, 1 / 4, "#f9bd30", 87, 83, 65, 68),
	new Character(3 / 4, 3 / 4, "#fb4934", 38, 40, 37, 39),
];

function keySet(keyCode, state) {
	for (const char of chars) {
		for (const key in char.keyCodes) {
			if (keyCode == char.keyCodes[key]) {
				char.keyStates[key] = state;
			}
		}
	}
}

class PowerUp {
	constructor() {
		// no powerups within 40px of edges of frame
		this.x = 40 + Math.random() * (frameWidth - 80);
		this.y = 40 + Math.random() * (frameHeight - 80);
		this.color = undefined;
	}

	// draw powerup
	draw() {
		c.main.translate(this.x, this.y);

		// circle
		c.main.globalAlpha = 0.5;
		c.main.fillStyle = this.color;
		c.main.beginPath();
		c.main.arc(0, 0, RADIUS, 0, 2 * Math.PI);
		c.main.strokeStyle = BACKGROUND_COLOR;
		c.main.lineWidth = 6;
		c.main.stroke();
		c.main.fill();

		// draw symbol for powerup
		c.main.globalAlpha = 0.7;
		c.main.strokeStyle = "#fff";
		c.main.lineWidth = 4;
		this.drawSymbol();

		c.main.translate(-this.x, -this.y);
		c.main.globalAlpha = 1;
	}

	drawSymbol() {
		c.main.strokeRect(-8, -8, 16, 16);
	}

	applyEffect(char) {
		console.log("no effect implemented");
	}
}

class MoreSword extends PowerUp {
	color = "#458588";
	applyEffect(char) {
		if (char.swordLength >= SWORD_LENGTH * 2) {
			char.swordLength = SWORD_LENGTH * 0.7;
		} else {
			char.swordLength += SWORD_LENGTH * 0.3;
		}
	}
	// draw arrow icon <->
	drawSymbol() {
		// line -
		c.main.beginPath();
		c.main.moveTo(-12, 0);
		c.main.lineTo(12, 0);
		// first chevron <
		c.main.moveTo(-7, -6);
		c.main.lineTo(-12, 0);
		c.main.lineTo(-7, 6);
		// second chevron >
		c.main.moveTo(7, -6);
		c.main.lineTo(12, 0);
		c.main.lineTo(7, 6);
		c.main.stroke();
	}
}

class MoreThrust extends PowerUp {
	color = "#d65d0e";
	applyEffect(char) {
		if (char.thrust >= THRUST * 2) {
			char.thrust = THRUST * 0.6;
		} else {
			char.thrust += THRUST * 0.2;
		}
	}

	// draw different double chevron icon >>
	drawSymbol() {
		// first chevron >
		c.main.beginPath();
		c.main.moveTo(-9, -9);
		c.main.lineTo(0, 0);
		c.main.lineTo(-9, 9);
		c.main.stroke();
		// second chevron >
		c.main.beginPath();
		c.main.moveTo(3, -9);
		c.main.lineTo(12, 0);
		c.main.lineTo(3, 9);
		c.main.stroke();
	}
}

class Wrap extends PowerUp {
	color = "#b16286";
	applyEffect(char) {
		char.wrap = !char.wrap;
	}
	// draw swirly portal icon
	drawSymbol() {
		c.main.beginPath();
		// draw three arcs (, rotating each time
		for (let i = 0; i < 3; i++) {
			c.main.moveTo(0, 4);
			c.main.arc(0, -4, 8, 1.2, 1.5 * Math.PI);
			c.main.rotate((Math.PI * 2) / 3);
		}
		c.main.stroke();
	}
}

function randomPowerUp() {
	let rand = Math.floor(Math.random() * 3);
	switch (rand) {
		case 0:
			return new MoreSword();
		case 1:
			return new MoreThrust();
		case 2:
			return new Wrap();
		default:
			console.log("modify number of power ups in randomPowerUp()!");
			return new MoreSword();
	}
}

let powerUps = [];

function step() {
	// draw background
	if (lastPointTTL) {
		if (lastPointTTL == 40) {
			drawScoreBoard();
		}
		c.msg.clearRect(0, 0, frameWidth, frameHeight);
		c.msg.globalAlpha = Math.min(1, lastPointTTL / 60);
		c.msg.textAlign = "center";
		c.msg.font = (81 - lastPointTTL) ** 4 / 40000 + "px " + FONT_FAMILY;
		c.msg.fillStyle = lastPointColor;
		c.msg.fillText("yeah!", frameWidth / 2, frameHeight / 2);
		lastPointTTL--;
		if (lastPointTTL == 0) {
			resetScreen();
			c.msg.clearRect(0, 0, frameWidth, frameHeight);
		}
	} else {
		c.main.fillStyle = BACKGROUND_COLOR + "bb";
		c.main.fillRect(0, 0, frameWidth, frameHeight);
		for (const pow of powerUps) {
			pow.draw();
		}
		for (const char of chars) {
			char.update();
			char.draw();
		}
		for (const char of chars) {
			char.detectHits();
		}
	}
	// random chance of adding new powerup
	if (Math.random() < POWER_UP_PROBABILITY) {
		powerUps.push(randomPowerUp());
	}
	window.requestAnimationFrame(step);
}

function resize() {
	// get window size
	frameWidth = window.innerWidth * window.devicePixelRatio;
	frameHeight = window.innerHeight * window.devicePixelRatio;
	// resize canvases
	for (const layerName in canvases) {
		canvases[layerName].width = frameWidth;
		canvases[layerName].height = frameHeight;
	}
	// make sure characters are in frame
	for (const char of chars) {
		char.x = Math.min(char.x, frameWidth - RADIUS);
		char.y = Math.min(char.y, frameHeight - RADIUS);
	}
	// set context settings because for some reason they get cleared
	c.main.lineCap = "round";
	c.main.lineJoin = "round";
	c.score.globalAlpha = 0.5;
	// c.main.globalCompositeOperation = "difference";
	drawScoreBoard();
}

function resetScreen() {
	c.main.fillStyle = BACKGROUND_COLOR;
	c.main.fillRect(0, 0, frameWidth, frameHeight);
	for (const char of chars) {
		char.reset();
		char.draw();
	}
	powerUps = [];
	drawScoreBoard();
}

function drawScoreBoard() {
	c.score.clearRect(0, 0, frameWidth, frameHeight);
	c.score.font = "140px " + FONT_FAMILY;

	// separator
	c.score.textAlign = "center";
	c.score.fillStyle = NEUTRAL_COLOR;
	c.score.fillText("-", frameWidth / 2, 120);
	// first character
	c.score.textAlign = "right";
	c.score.fillStyle = chars[0].color;
	c.score.fillText(chars[0].score, frameWidth / 2 - 30, 120);
	// second character
	c.score.textAlign = "left";
	c.score.fillStyle = chars[1].color;
	c.score.fillText(chars[1].score, frameWidth / 2 + 30, 120);
}
