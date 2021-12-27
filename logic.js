// initialize canvas vars
let mainCanvas,
	scoreCanvas,
	ctx,
	scoreCtx,
	msg,
	frameWidth,
	frameHeight,
	pointWinner = null,
	pointScored = false;

// constants
const BACKGROUND_COLOR = "#232323",
	NEUTRAL_COLOR = "#666666",
	FONT_FAMILY = "Balsamiq Sans, sans-serif",
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
	mainCanvas = document.getElementById("main-canvas");
	ctx = mainCanvas.getContext("2d", { alpha: false });

	scoreCanvas = document.getElementById("score-canvas");
	scoreCtx = scoreCanvas.getContext("2d");

	msg = document.getElementById("message");
	// reset frame size and character positions
	resize();
	resetScreen();
	drawScoreBoard();
	window.addEventListener("resize", resize, false);
	// begin animation
	window.requestAnimationFrame(step);
};

class Character {
	constructor(xPortion, yPortion, name, color, upKeyCode, downKeyCode, leftKeyCode, rightKeyCode) {
		this.xPortion = xPortion;
		this.yPortion = yPortion;
		this.name = name;
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
		// set velocity to point toward center with ridiculously small magnitude
		// just to make sword point toward center
		this.xv = 1e-20 * (frameWidth / 2 - this.x);
		this.yv = 1e-20 * (frameHeight / 2 - this.y);
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
		ctx.fillStyle = this.color;
		ctx.strokeStyle = this.color;
		ctx.lineWidth = SWORD_WIDTH;
		ctx.beginPath();
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.swordX, this.swordY);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.x, this.y, RADIUS, 0, 2 * Math.PI);
		ctx.fill();
	}

	detectHits() {
		// detect hits of other chars
		for (const otherChar of chars) {
			if (this !== otherChar && this.isTouching(otherChar)) {
				this.givePoint();
			}
		}
		// detect hits of power ups
		// backward indexed loop to allow removal of power ups
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
		// if this is the first winner this frame
		if (pointScored === false) {
			this.score++;
			pointWinner = this;
			pointScored = true;
		} else if (pointWinner != null) {
			pointWinner.score--;
			pointWinner = null;
		}
	}
}

// characters
let chars = [
	new Character(1 / 4, 1 / 4, "yellow", "#f9bd30", 87, 83, 65, 68),
	new Character(3 / 4, 3 / 4, "red", "#fb4934", 38, 40, 37, 39),
];

function keySet(keyCode, state) {
	for (const char of chars) {
		for (const key in char.keyCodes) {
			if (keyCode === char.keyCodes[key]) {
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
		ctx.translate(this.x, this.y);
		ctx.globalAlpha = 0.65;

		// circle
		ctx.fillStyle = this.color;
		ctx.beginPath();
		ctx.arc(0, 0, RADIUS, 0, 2 * Math.PI);
		ctx.strokeStyle = BACKGROUND_COLOR;
		ctx.lineWidth = 6;
		ctx.stroke();
		ctx.fill();

		// draw symbol for powerup
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 4;
		this.drawSymbol();

		ctx.translate(-this.x, -this.y);
		ctx.globalAlpha = 1;
	}

	drawSymbol() {
		ctx.strokeRect(-8, -8, 16, 16);
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
		ctx.beginPath();
		ctx.moveTo(-12, 0);
		ctx.lineTo(12, 0);
		// first chevron <
		ctx.moveTo(-7, -6);
		ctx.lineTo(-12, 0);
		ctx.lineTo(-7, 6);
		// second chevron >
		ctx.moveTo(7, -6);
		ctx.lineTo(12, 0);
		ctx.lineTo(7, 6);
		ctx.stroke();
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
		ctx.beginPath();
		ctx.moveTo(-9, -9);
		ctx.lineTo(0, 0);
		ctx.lineTo(-9, 9);
		ctx.stroke();
		// second chevron >
		ctx.beginPath();
		ctx.moveTo(3, -9);
		ctx.lineTo(12, 0);
		ctx.lineTo(3, 9);
		ctx.stroke();
	}
}

class Wrap extends PowerUp {
	color = "#b16286";
	applyEffect(char) {
		char.wrap = !char.wrap;
	}
	// draw swirly portal icon
	drawSymbol() {
		ctx.beginPath();
		// draw three arcs (, rotating each time
		for (let i = 0; i < 3; i++) {
			ctx.moveTo(0, 4);
			ctx.arc(0, -4, 8, 1.2, 1.5 * Math.PI);
			ctx.rotate((Math.PI * 2) / 3);
		}
		ctx.stroke();
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
	// clear background
	ctx.fillStyle = BACKGROUND_COLOR + "bc";
	ctx.fillRect(0, 0, frameWidth, frameHeight);
	// draw powerups and characters
	for (const pow of powerUps) {
		pow.draw();
	}
	for (const char of chars) {
		char.update();
		char.draw();
	}
	// check for collisions
	for (const char of chars) {
		char.detectHits();
	}
	// check if a point was scored
	if (pointScored) {
		pointTransition();
		pointScored = false;
		return;
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
	mainCanvas.width = frameWidth;
	mainCanvas.height = frameHeight;
	scoreCanvas.width = frameWidth;
	scoreCanvas.height = frameHeight;

	// make sure characters are in frame
	for (const char of chars) {
		char.x = Math.min(char.x, frameWidth - RADIUS);
		char.y = Math.min(char.y, frameHeight - RADIUS);
	}
	// set context settings because for some reason they get cleared
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	scoreCtx.globalAlpha = 0.5;
	// ctx.globalCompositeOperation = "difference";
	drawScoreBoard();
}

function resetScreen() {
	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, frameWidth, frameHeight);
	for (const char of chars) {
		char.reset();
	}
	powerUps = [];
}

function drawScoreBoard() {
	scoreCtx.clearRect(0, 0, frameWidth, frameHeight);
	scoreCtx.font = "140px " + FONT_FAMILY;

	// separator
	scoreCtx.textAlign = "center";
	scoreCtx.fillStyle = NEUTRAL_COLOR;
	// for Balsamiq Sans, the hyphen has to be a bit higher than the numbers to look centered
	scoreCtx.fillText("-", frameWidth / 2, 110);
	// first character
	scoreCtx.textAlign = "right";
	scoreCtx.fillStyle = chars[0].color;
	scoreCtx.fillText(chars[0].score, frameWidth / 2 - 30, 120);
	// second character
	scoreCtx.textAlign = "left";
	scoreCtx.fillStyle = chars[1].color;
	scoreCtx.fillText(chars[1].score, frameWidth / 2 + 30, 120);
}

function pointTransition() {
	// trigger win message
	if (pointWinner === null) {
		msg.style.color = NEUTRAL_COLOR;
		msg.textContent = "tie!";
	} else {
		msg.style.color = pointWinner.color;
		msg.textContent = `point for ${pointWinner.name}!`;
	}
	msg.classList.add("shown");

	// update scoreboard after a delay
	setTimeout(drawScoreBoard, 600);
	// after a delay, reset the screen and resume animation
	setTimeout(() => {
		resetScreen();
		window.requestAnimationFrame(step);
	}, 1200);
	setTimeout(() => {
		msg.classList.remove("shown");
	}, 2000);
}
