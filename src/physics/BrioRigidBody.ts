import { BrioVec3, Vec3 } from "../math/vec3";
import { BrioTransform2D } from "../objects/BrioTransform2D";
import { BrioTransform3D } from "../objects/BrioTransform3D";

/**
 * Configuration options for initializing a `BrioRigidBody`.
 */
export interface BrioRigidBodyOptions {
    /** Mass of the body in kilograms (defaults to `1`, must be `> 0`). */
    mass?: number;
    /** Gravity acceleration vector (defaults to `{ x: 0, y: 0, z: 0 }`). */
    gravity?: Vec3;
    /** Linear velocity damping / friction factor in `[0, 1]` applied per second (defaults to `0`). */
    friction?: number;
    /** Bounciness / coefficient of restitution in `[0, 1]` (defaults to `0`). */
    restitution?: number;
    /** If `true`, the body does not move under forces or impulses (defaults to `false`). */
    isStatic?: boolean;
}

/**
 * Physical simulation profile (`BrioRigidBody`) governing velocity, acceleration, gravity, mass,
 * friction, and restitution for either a 2D (`BrioTransform2D`) or 3D (`BrioTransform3D`) object.
 *
 * @example
 * ```ts
 * const body = new BrioRigidBody({ gravity: { x: 0, y: 980, z: 0 }, friction: 0.1 });
 * body.applyImpulse({ x: 0, y: -400, z: 0 });
 * body.integrate2D(player.transform, dt);
 * ```
 */
export class BrioRigidBody {
    /** Linear velocity vector (`px/s` in 2D or `units/s` in 3D). */
    public readonly velocity: BrioVec3 = new BrioVec3(0, 0, 0);
    /** Linear acceleration accumulator. */
    public readonly acceleration: BrioVec3 = new BrioVec3(0, 0, 0);
    /** Gravity acceleration vector applied each step. */
    public readonly gravity: BrioVec3;

    #mass: number;
    #invMass: number;
    #friction: number;
    #restitution: number;
    #isStatic: boolean;

    /**
     * Creates a new `BrioRigidBody` simulation profile.
     *
     * @param options Optional initial physics parameters
     */
    constructor(options: BrioRigidBodyOptions = {}) {
        this.#mass = Math.max(1e-4, options.mass ?? 1);
        this.#invMass = options.isStatic ? 0 : 1 / this.#mass;
        this.#friction = Math.max(0, Math.min(1, options.friction ?? 0));
        this.#restitution = Math.max(0, Math.min(1, options.restitution ?? 0));
        this.#isStatic = options.isStatic ?? false;
        const g = options.gravity ?? { x: 0, y: 0, z: 0 };
        this.gravity = new BrioVec3(g.x, g.y, g.z);
    }

    /** Mass of the rigid body (`> 0`). */
    public get mass(): number {
        return this.#mass;
    }
    public set mass(value: number) {
        this.#mass = Math.max(1e-4, value);
        this.#invMass = this.#isStatic ? 0 : 1 / this.#mass;
    }

    /** Inverse mass (`1 / mass`, or `0` when `isStatic === true`). */
    public get inverseMass(): number {
        return this.#invMass;
    }

    /** Linear damping/friction coefficient in `[0, 1]`. */
    public get friction(): number {
        return this.#friction;
    }
    public set friction(value: number) {
        this.#friction = Math.max(0, Math.min(1, value));
    }

    /** Coefficient of restitution (bounciness) in `[0, 1]`. */
    public get restitution(): number {
        return this.#restitution;
    }
    public set restitution(value: number) {
        this.#restitution = Math.max(0, Math.min(1, value));
    }

    /** Indicates whether this body is immovable (`true`). */
    public get isStatic(): boolean {
        return this.#isStatic;
    }
    public set isStatic(value: boolean) {
        this.#isStatic = value;
        this.#invMass = value ? 0 : 1 / this.#mass;
        if (value) {
            this.velocity.set(0, 0, 0);
            this.acceleration.set(0, 0, 0);
        }
    }

    /**
     * Applies a continuous force vector $F$ to the body ($a += F / m$).
     *
     * @param force Force vector `{ x, y, z }`
     * @example
     * ```ts
     * body.applyForce({ x: 500, y: 0, z: 0 });
     * ```
     */
    public applyForce(force: { x: number; y: number; z?: number }): void {
        if (this.#isStatic) return;
        this.acceleration.x += force.x * this.#invMass;
        this.acceleration.y += force.y * this.#invMass;
        this.acceleration.z += (force.z ?? 0) * this.#invMass;
    }

    /**
     * Applies an instantaneous impulse vector $J$ to the body ($v += J / m$).
     *
     * @param impulse Impulse vector `{ x, y, z }`
     * @example
     * ```ts
     * body.applyImpulse({ x: 0, y: -350 });
     * ```
     */
    public applyImpulse(impulse: { x: number; y: number; z?: number }): void {
        if (this.#isStatic) return;
        this.velocity.x += impulse.x * this.#invMass;
        this.velocity.y += impulse.y * this.#invMass;
        this.velocity.z += (impulse.z ?? 0) * this.#invMass;
    }

    /**
     * Integrates velocity and position for a 2D `BrioTransform2D` over `dt` seconds (Semi-Implicit Euler).
     *
     * @param transform Target 2D transform
     * @param dt Elapsed time step in seconds
     * @example
     * ```ts
     * body.integrate2D(player.transform, dt);
     * ```
     */
    public integrate2D(transform: BrioTransform2D, dt: number): void {
        if (this.#isStatic || dt <= 0) return;

        this.velocity.x += (this.acceleration.x + this.gravity.x) * dt;
        this.velocity.y += (this.acceleration.y + this.gravity.y) * dt;

        if (this.#friction > 0) {
            const damping = Math.max(0, 1 - this.#friction * dt);
            this.velocity.x *= damping;
            this.velocity.y *= damping;
        }

        transform.position.x += this.velocity.x * dt;
        transform.position.y += this.velocity.y * dt;

        this.acceleration.set(0, 0, 0);
    }

    /**
     * Integrates velocity and position for a 3D `BrioTransform3D` over `dt` seconds (Semi-Implicit Euler).
     *
     * @param transform Target 3D transform
     * @param dt Elapsed time step in seconds
     * @example
     * ```ts
     * body.integrate3D(crate.transform, dt);
     * ```
     */
    public integrate3D(transform: BrioTransform3D, dt: number): void {
        if (this.#isStatic || dt <= 0) return;

        this.velocity.x += (this.acceleration.x + this.gravity.x) * dt;
        this.velocity.y += (this.acceleration.y + this.gravity.y) * dt;
        this.velocity.z += (this.acceleration.z + this.gravity.z) * dt;

        if (this.#friction > 0) {
            const damping = Math.max(0, 1 - this.#friction * dt);
            this.velocity.x *= damping;
            this.velocity.y *= damping;
            this.velocity.z *= damping;
        }

        transform.position.x += this.velocity.x * dt;
        transform.position.y += this.velocity.y * dt;
        transform.position.z += this.velocity.z * dt;

        this.acceleration.set(0, 0, 0);
    }
}
