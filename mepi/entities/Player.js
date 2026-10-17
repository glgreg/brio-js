import { BrioCollision } from "../../dist/index.js";
import { Entity } from "./Entity.js";

/**
 * Player Knight character extending Entity.
 */
export class Player extends Entity {
    /** @type {number} */
    moveSpeed = 155;
    /** @type {number} */
    jumpForce = -365;
    /** @type {number} */
    gravity = 920;
    /** @type {number} */
    maxFallSpeed = 460;

    /** @type {number} */
    coyoteTimer = 0;
    /** @type {number} */
    coyoteTimeDuration = 0.12;
    /** @type {number} */
    jumpBufferTimer = 0;
    /** @type {number} */
    jumpBufferDuration = 0.12;

    /** @type {number} */
    animTimer = 0;
    /** @type {number} */
    animFrame = 0;
    /** @type {number} */
    rollFrame = 0;

    /** @type {{ x: number, y: number }} */
    spawnPoint = { x: 40, y: 260 };

    /** @type {number} */
    score = 0;
    /** @type {number} */
    coins = 0;
    /** @type {number} */
    lives = 3;

    /** @type {import("../../dist/assets/BrioAudio.js").BrioAudio | null} */
    jumpAudio = null;
    /** @type {import("../../dist/assets/BrioAudio.js").BrioAudio | null} */
    hurtAudio = null;
    /** @type {import("../../dist/assets/BrioAudio.js").BrioAudio | null} */
    stompAudio = null;

    /**
     * @param {string} name
     * @param {number} x
     * @param {number} y
     */
    constructor(name, x = 40, y = 260) {
        super(name, "spr_knight_idle_0", 4, 3);

        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = 32;
        this.transform.size.y = 32;
        this.spawnPoint = { x, y };

        BrioCollision.addRectangle({
            object: this,
            colliderType: "solid",
            pos: { x: 9, y: 8 },
            size: { x: 14, y: 20 },
        });
    }

    /**
     * @param {import("../../dist/input/BrioKeyboard.js").BrioKeyboard} keyboard
     * @param {number} dt
     * @param {import("./Platform.js").Platform[]} platforms
     * @param {import("./Enemy.js").Enemy[]} enemies
     * @param {import("./Collectible.js").Collectible[]} collectibles
     * @param {import("./Hazard.js").Hazard[]} hazards
     * @param {import("./Goal.js").Goal | null} goal
     * @param {number} screenHeight
     * @param {() => void} [onLevelComplete]
     */
    update(
        keyboard,
        dt,
        platforms,
        enemies,
        collectibles,
        hazards,
        goal,
        screenHeight,
        onLevelComplete,
    ) {
        if (this.isDead) {
            this.handleDeathAnimation(dt);
            return;
        }

        // Invulnerability Blink Timer
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer -= dt;
            this.transform.opacity = Math.floor(this.invulnerableTimer * 14) % 2 === 0 ? 0.3 : 1;
            if (this.invulnerableTimer <= 0) {
                this.transform.opacity = 1;
            }
        }

        // Horizontal Input with smooth acceleration and deceleration
        let moveDir = 0;
        if (keyboard.isDown("ArrowLeft") || keyboard.isDown("a") || keyboard.isDown("A")) {
            moveDir -= 1;
            this.transform.flip.x = true;
        }
        if (keyboard.isDown("ArrowRight") || keyboard.isDown("d") || keyboard.isDown("D")) {
            moveDir += 1;
            this.transform.flip.x = false;
        }

        const accel = this.isGrounded ? 1400 : 900;
        const friction = this.isGrounded ? 1500 : 500;

        if (moveDir !== 0) {
            if (Math.sign(this.velocity.x) !== 0 && Math.sign(this.velocity.x) !== moveDir) {
                this.velocity.x = 0;
            }
            this.velocity.x =
                Math.sign(moveDir) *
                Math.min(this.moveSpeed, Math.abs(this.velocity.x) + accel * dt);
        } else {
            if (Math.abs(this.velocity.x) <= friction * dt) {
                this.velocity.x = 0;
            } else {
                this.velocity.x -= Math.sign(this.velocity.x) * friction * dt;
            }
        }

        // Coyote Time & Jump Buffering
        if (this.isGrounded) {
            this.coyoteTimer = this.coyoteTimeDuration;
        } else {
            this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
        }

        const wantsToJump =
            keyboard.isDown("ArrowUp") ||
            keyboard.isDown("w") ||
            keyboard.isDown("W") ||
            keyboard.isDown(" ") ||
            keyboard.isDown("z") ||
            keyboard.isDown("Z");

        if (wantsToJump) {
            this.jumpBufferTimer = this.jumpBufferDuration;
        } else {
            this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
        }

        // Execute Jump
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
            if (this.jumpAudio) {
                this.jumpAudio.play();
            }
        }

        // Variable Jump Cut
        if (!wantsToJump && this.velocity.y < -100) {
            this.velocity.y *= 0.6;
        }

        // Apply Gravity
        this.velocity.y += this.gravity * dt;
        if (this.velocity.y > this.maxFallSpeed) {
            this.velocity.y = this.maxFallSpeed;
        }

        // Resolve platform movement and AABB collisions
        this.moveAndCollide(dt, platforms);

        // Enemy collisions & Stomp detection
        this.checkEnemyCollisions(enemies);

        // Collectibles
        this.checkCollectibleCollisions(collectibles);

        // Hazards
        this.checkHazardCollisions(hazards);

        // Goal exit trigger
        if (goal && !goal.isTriggered && BrioCollision.isColliding(this, goal)) {
            if (onLevelComplete) {
                onLevelComplete();
            }
        }

        // Pit fall check
        if (this.transform.position.y > screenHeight + 40) {
            this.handleFallOut();
        }

        // Update Animation
        this.updateAnimation(dt, moveDir);
    }

    /**
     * Resolves movement and collisions against platforms.
     * @param {number} dt
     * @param {import("./Platform.js").Platform[]} platforms
     */
    moveAndCollide(dt, platforms) {
        const colliderOffset = this.collision?.pos ?? { x: 9, y: 8 };
        const colliderSize = this.collision?.size ?? { x: 14, y: 24 };

        // 1. Horizontal Resolution
        this.transform.position.x += this.velocity.x * dt;

        for (const platform of platforms) {
            if (!platform.collision || !platform.collision.enabled) continue;
            if (BrioCollision.isColliding(this, platform)) {
                const platLeft = platform.transform.position.x + platform.collision.pos.x;
                const platRight = platLeft + platform.collision.size.x;

                if (this.velocity.x > 0) {
                    this.transform.position.x = platLeft - colliderOffset.x - colliderSize.x;
                    this.velocity.x = 0;
                } else if (this.velocity.x < 0) {
                    this.transform.position.x = platRight - colliderOffset.x;
                    this.velocity.x = 0;
                }
            }
        }

        // 2. Vertical Resolution
        this.transform.position.y += this.velocity.y * dt;
        let groundedThisFrame = false;

        for (const platform of platforms) {
            if (!platform.collision || !platform.collision.enabled) continue;
            if (BrioCollision.isColliding(this, platform)) {
                const platTop = platform.transform.position.y + platform.collision.pos.y;
                const platBottom = platTop + platform.collision.size.y;

                if (this.velocity.y > 0) {
                    // Landing on top
                    this.transform.position.y = platTop - colliderOffset.y - colliderSize.y;
                    this.velocity.y = 0;
                    groundedThisFrame = true;

                    // Carry player on moving platform
                    if (platform.isMoving) {
                        this.transform.position.x += platform.deltaX;
                        this.transform.position.y += platform.deltaY;
                    }
                } else if (this.velocity.y < 0) {
                    // Hitting ceiling
                    this.transform.position.y = platBottom - colliderOffset.y;
                    this.velocity.y = 0;
                }
            }
        }

        this.isGrounded = groundedThisFrame;
    }

    /**
     * Checks collision with enemies (stomp vs damage).
     * @param {import("./Enemy.js").Enemy[]} enemies
     */
    checkEnemyCollisions(enemies) {
        if (this.isDead) return;

        const colliderOffset = this.collision?.pos ?? { x: 9, y: 8 };
        const colliderSize = this.collision?.size ?? { x: 14, y: 24 };
        const playerBottom = this.transform.position.y + colliderOffset.y + colliderSize.y;

        for (const enemy of enemies) {
            if (enemy.isDead || !enemy.collision || !enemy.collision.enabled) continue;

            if (BrioCollision.isColliding(this, enemy)) {
                const enemyTop = enemy.transform.position.y + enemy.collision.pos.y;
                const enemyMidY = enemyTop + enemy.collision.size.y * 0.45;

                // Stomp detection
                if (this.velocity.y > 0 && playerBottom <= enemyMidY + 6) {
                    const awardedScore = enemy.defeat(this.stompAudio);
                    this.score += awardedScore;
                    this.velocity.y = this.jumpForce * 0.75; // Bounce
                    this.isGrounded = false;
                } else {
                    // Hurt
                    const tookDamage = this.takeDamage(1);
                    if (tookDamage) {
                        if (this.hurtAudio) this.hurtAudio.play();
                        this.velocity.x =
                            this.transform.position.x < enemy.transform.position.x ? -170 : 170;
                        this.velocity.y = -210;
                        this.isGrounded = false;
                    }
                }
            }
        }
    }

    /**
     * Checks collision with collectibles.
     * @param {import("./Collectible.js").Collectible[]} collectibles
     */
    checkCollectibleCollisions(collectibles) {
        for (const item of collectibles) {
            if (item.isCollected || !item.collision || !item.collision.enabled) continue;

            if (BrioCollision.isColliding(this, item)) {
                const result = item.collect();
                if (result.value > 0) {
                    this.score += result.value;
                    if (result.isCoin) this.coins += 1;
                    if (result.heals > 0) this.heal(result.heals);
                }
            }
        }
    }

    /**
     * Checks collision with hazards.
     * @param {import("./Hazard.js").Hazard[]} hazards
     */
    checkHazardCollisions(hazards) {
        if (this.isDead || this.invulnerableTimer > 0) return;

        for (const hazard of hazards) {
            if (BrioCollision.isColliding(this, hazard)) {
                const tookDamage = this.takeDamage(hazard.damage);
                if (tookDamage) {
                    if (this.hurtAudio) this.hurtAudio.play();
                    this.velocity.y = -240;
                }
            }
        }
    }

    /**
     * Handles falling off screen.
     */
    handleFallOut() {
        this.lives -= 1;
        if (this.hurtAudio) this.hurtAudio.play();

        if (this.lives > 0) {
            this.respawn();
        } else {
            this.isDead = true;
            this.health = 0;
        }
    }

    /**
     * Respawns player at start.
     */
    respawn() {
        this.transform.position.x = this.spawnPoint.x;
        this.transform.position.y = this.spawnPoint.y;
        this.velocity = { x: 0, y: 0 };
        this.health = this.maxHealth;
        this.invulnerableTimer = 1.5;
        this.isDead = false;
    }

    /**
     * Updates player animation frame based on current state.
     * @param {number} dt
     * @param {number} moveDir
     */
    updateAnimation(dt, moveDir) {
        this.animTimer += dt;

        // In Air (Jumping / Falling)
        if (!this.isGrounded) {
            if (this.animTimer >= 0.1) {
                this.animTimer = 0;
                this.rollFrame = (this.rollFrame + 1) % 4;
            }
            this.sprite = `spr_knight_roll_${this.rollFrame}`;
            return;
        }

        // Running
        if (Math.abs(this.velocity.x) > 10) {
            // Speed-synchronized running frame interval (smooth 16 frames)
            const frameDuration = Math.max(
                0.035,
                0.07 - (Math.abs(this.velocity.x) / this.moveSpeed) * 0.035,
            );
            if (this.animTimer >= frameDuration) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 16;
                this.sprite = `spr_knight_run_${this.animFrame}`;
            }
        } else {
            // Idle
            if (this.animTimer >= 0.18) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 4;
                this.sprite = `spr_knight_idle_${this.animFrame}`;
            }
        }
    }

    /**
     * Handles death animation.
     * @param {number} dt
     */
    handleDeathAnimation(dt) {
        this.animTimer += dt;
        const deathFrame = Math.min(7, Math.floor(this.animTimer * 7));
        this.sprite = `spr_knight_death_${deathFrame}`;
    }
}
