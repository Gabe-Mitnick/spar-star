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
	FONT_FAMILY = "AmadorW01-Regular, serif",
	// character size
	CHAR_RADIUS = 20,
	SWORD_LENGTH = 150,
	// physics
	THRUST = 1,
	FRICTION = 0.98,
	BOUNCE_COEF = 0.9,
	// to normalize diagonal acceleration
	ROOT_2 = Math.sqrt(0.5),
	// 0.002
	POWER_UP_PROBABILITY = 0.001;

window.onload = function() {
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
	
	reset() {
		this.swordLength = SWORD_LENGTH;
		this.thrust = THRUST;
		this.x = this.xPortion * frameWidth;
		this.y = this.yPortion * frameHeight;
		this.yv = this.xv = 0;
	}

	update() {
		this.xv *= FRICTION;
		this.yv *= FRICTION;

		// fix diagonal acceleration
		let adjustment = (this.keyStates.right + this.keyStates.left == 1) &&
			(this.keyStates.up + this.keyStates.down == 1) ? ROOT_2 : 1;

		this.xv += (this.keyStates.right - this.keyStates.left) * adjustment * this.thrust;
		this.yv += (this.keyStates.down - this.keyStates.up) * adjustment * this.thrust;

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

		// // wrap
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
		this.swordX = this.x + this.xv / velocityMagnitude * this.swordLength;
		this.swordY = this.y + this.yv / velocityMagnitude * this.swordLength;
	}

	draw() {
		// draw character
		c.main.fillStyle = this.color;
		c.main.strokeStyle = this.color;
		c.main.lineWidth = 8;
		c.main.beginPath();
		c.main.moveTo(this.x, this.y);
		c.main.lineTo(this.swordX, this.swordY);
		c.main.stroke();
		c.main.closePath();
		c.main.beginPath();
		c.main.arc(this.x, this.y, CHAR_RADIUS, 0, 2 * Math.PI);
		c.main.fill();
	}

	detectHit() {
		// see if "this" has hit another char
		for (const char of chars) {
			if (this !== char) {
				// projection of vector from this char to other char onto sword vector
				let vertDist = ((this.swordX - this.x) * (char.x - this.x) +
					(this.swordY - this.y) * (char.y - this.y)) / this.swordLength;
				// projection of vector from this char to other char onto normal of sword vector
				let horizDist = Math.abs((this.swordY - this.y) * (char.x - this.x) -
					(this.swordX - this.x) * (char.y - this.y)) / this.swordLength;

				if (
					// CHECK SLICE
					horizDist <= CHAR_RADIUS && 0 <= vertDist && vertDist <= this.swordLength ||
					// CHECK STAB
					(this.swordX - char.x) ** 2 + (this.swordY - char.y) ** 2 <= CHAR_RADIUS
				) {
					this.givePoint();
				}
			}
		}
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
	new Character(1/4, 1/4, "#f9bd30", 87, 83, 65, 68),
	new Character(3/4, 3/4, "#fb4934", 38, 40, 37, 39),
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
		this.x = Math.random() * frameWidth;
		this.y = Math.random() * frameHeight;
	}

	draw() {
		// draw powerup
		// console.log('drew powerup at ' + this.x + ', ' + this.y);
		c.main.fillStyle = this.color;
		c.main.beginPath();
		c.main.arc(this.x, this.y, CHAR_RADIUS, 0, 2 * Math.PI);
		c.main.fill();
	}

	checkCollision(char) {
		if ((char.x - this.x) ** 2 + (char.y - this.y) ** 2 < CHAR_RADIUS ** 2 * 4) {
			this.applyEffect(char);
			// remove self from powerUps list
			powerUps.splice(powerUps.indexOf(this), 1);
		}
	}

	applyEffect(char) {
		console.log("no effect implemented");
	}
}

class MoreSword extends PowerUp {
	color = "#b16286";
	applyEffect(char) {
		char.swordLength *= 1.2;
	}
}
class LessSword extends PowerUp {
	color = "#458588";
	applyEffect(char) {
		char.swordLength /= 1.2;
	}
}
class MoreThrust extends PowerUp {
	color = "#b8bb26";
	applyEffect(char) {
		char.thrust *= 1.2;
	}
}
class LessThrust extends PowerUp {
	color = "#fe8019";
	applyEffect(char) {
		char.thrust /= 1.2;
	}
}
// class MirrorTeammate extends PowerUp {
// 	color = "#999999";
// 	applyEffect(char) {
// 		console.log(char);
// 		let teammate = new Character(1/2, 1/2, char.color, 
// 			char.downKeyCode, char.upKeyCode, char.rightKeyCode, char.leftKeyCode);
// 		teammate.swordLength = char.sword;
// 		teammate.thrust = char.thrust;
// 		teammate.x = frameWidth - char.x;
// 		teammate.y = frameHeight - char.y;
// 		teammate.xv = -teammate.xv;
// 		teammate.yv = -teammate.yv;
// 		console.log(teammate.keyCodes);
// 		chars.push(teammate);
// 		console.log(teammate.keyCodes);
// 		// chars.push(new Character(1/4, 1/4, "#f9bd30", 87, 83, 65, 68));
// 		console.log(chars);
// 		// chars[2].draw();
// 	}
// }

function randomPowerUp() {
	let rand = Math.floor(Math.random() * 4);
	switch (rand) {
		case 0:
			return new MoreSword();
		case 1:
			return new LessSword();
		case 2:
			return new MoreThrust();
		case 3:
			return new LessThrust();
		case 4:
			// return new MirrorTeammate();
		default:
			break;
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
		c.msg.font = ((81 - lastPointTTL) ** 4 / 40000) + "px " + FONT_FAMILY;
		c.msg.fillStyle = lastPointColor;
		c.msg.fillText("yeah!", frameWidth / 2, frameHeight / 2);
		lastPointTTL--;
		if (lastPointTTL == 0) {
			resetScreen();
			c.msg.clearRect(0, 0, frameWidth, frameHeight);
		}
	} else {
		c.main.fillStyle = BACKGROUND_COLOR + "aa";
		c.main.fillRect(0, 0, frameWidth, frameHeight);
		for (const char of chars) {
			char.update();
			char.draw();
		}
		for (const char of chars) {
			char.detectHit();
		}
		for (const pow of powerUps) {
			pow.draw();
			for (const char of chars) {
				pow.checkCollision(char);
			}
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
		char.x = Math.min(char.x, frameWidth - CHAR_RADIUS);
		char.y = Math.min(char.y, frameHeight - CHAR_RADIUS);
	}
	// set context settings because for some reason they get cleared
	c.main.lineCap = "round";
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
