export interface StartingTime {
    name: string;
    time: number;
}
type IterationTypes = "once" | "many" | "loop";
interface PlayTogetherConfig {
    /** The iteration type used ("once", "loop", "many") */
    iterationType?: IterationTypes;
    /** The quantity of iterations when using iterationType: "many" */
    iterationQuantity?: number;
    /** Chooses which audio should play at which time */
    startingTime?: StartingTime[];
}
/** A class used to instantiate BrioAudio objects that can
 * be played, paused, resumed, loooped through and linked to BrioObject objects
 * and more */
export declare class BrioAudio {
    #private;
    /**
     * @param name A name for the audio object
     * @param src The source URL for the targeted audio
     * @example game.preload(() => {
     *
     * const aud_player_jump = new BrioAudio("aud_player_jump", "./audios/player_jump.mp3");
     * return [aud_player_jump]; // now the "aud_player_jump" BrioAudio can be used in the 'load' step
     * });
     */
    constructor(name: string, src: string);
    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */
    /**
     * Returns the name of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.name); // aud_player_jump
     */
    get name(): string;
    /**
     * Returns the source URL of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.src); // player_jump.mp3
     */
    get src(): string;
    /**
     * Returns the element of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.element); // <audio preload="auto" src="./player_jump.mp3">
     */
    get element(): HTMLAudioElement;
    /**
     * Returns the duration of the audio, in seconds, used in the BrioAudio object
     * @example const aud = new BrioAudio("aud_main_song", "./main_song.mp3");
     * console.log(aud.duration); // 242.03 (duration of 2 minutes and 2 seconds)
     */
    get duration(): number;
    get isPaused(): boolean;
    /**
     * PUBLIC METHODS -------------------------------------------------------------------
     */
    /**
     * When correctly preloaded, plays the audio once
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_player_jump");
     * aud.play(); // plays the audio once as soon as the audio is ready
     * })
     */
    play(): void;
    /**
     * When correctly preloaded, plays the audio once and waits for it to be played again in the Audio Queue
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_player_jump");
     * aud.playOnce(); // plays the audio once as soon as the audio is ready
     * })
     */
    playOnce(): void;
    /**
     * When correctly preloaded, plays the audio from the second it was specified.
     * Using this method does not change the sound, so in a playLoop method
     * the second replay would just ignore the time that was specified.
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_main_song");
     * aud.playFromTime(20.5); // skips the first 20 seconds and 500 miliseconds of the specified sound
     * })
     */
    playFromTime(timeInSeconds: number): void;
    /**
     * Plays the audio the amount of times it was specified
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_player_punch");
     * aud.playMany(5); // plays the audio 5 times in sequence
     * })
     */
    playMany(iterations: number, delay?: number): void;
    /**
     * When correctly preloaded, plays the audio on a loop
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_player_punch");
     * aud.playLoop(); // plays the audio indefinitely in sequence
     * })
     */
    playLoop(): void;
    /**
     * Pauses the audio if currently playing
     * @example
     * const aud = loader.getAudio("aud_background_ambience");
     * aud.playLoop(); // plays the audio on a loop
     *
     * setTimeout(() => {
     * aud.pause();
     * }, 60 * 1000); // pauses the audio after 60 seconds
     * })
     */
    pause(): void;
    /**
     * Resumes the audio if currently paused
     * @example
     * const aud = loader.getAudio("aud_background_ambience");
     * aud.playLoop(); // plays the audio on a loop
     *
     * setTimeout(() => {
     * aud.pause();
     * }, 60 * 1000); // pauses the audio after 60 seconds
     *
     * setTimeout(() => {
     * aud.resume();
     * }, 30 * 1000);}); // resumes after 30 seconds of being paused
     */
    resume(): void;
    /**
     * When correctly preloaded, plays the audio many times at the sime time
     * @example game.load((loader) => {
     *
     * const aud = loader.getAudio("aud_explosion");
     * aud.playManyAtTime(3); // plays the audio indefinitely
     * })
     */
    playManyAtTime(quantity: number): void;
    /**
     * STATIC METHODS -------------------------------------------------------------------
     */
    /**
     * Play many audios at the same time
     * @param audios An array of BrioAudio objects to iterate through at the same time
     * @param configurationObject A configuration object for configuring iteration and timing of the audios
     *
     * @example game.load((loader) => {
     *
     * const aud_1 = loader.getAudio("aud_fire");
     * const aud_2 = loader.getAudio("aud_explosion")
     *
     * BrioAudio.playTogether([aud_1, aud_2]); // plays the 2 audios (only once by default)
     */
    static playTogether(audios: BrioAudio[], configurationObject?: PlayTogetherConfig): void;
    static playInSequence(audios: BrioAudio[]): Promise<void>;
    static getEmptyInstance(): BrioAudio;
}
export {};
//# sourceMappingURL=BrioAudio.d.ts.map