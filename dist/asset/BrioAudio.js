/** @classdesc A class used to instantiate BrioAudio objects that can
 * be played, paused, resumed, loooped through and linked to BrioObject objects
 * and more */
export class BrioAudio {
    /** @type {string} The name of the audio asset */
    #name;
    /** @type {string} The source URL used in the audio asset */
    #src;
    /** @type {string} Element created to receive the audio */
    #element;
    static #emptyInstance;
    /**
     * @param {string} name A name for the audio object
     * @param {string} src The source URL for the targeted audio
     * @example game.preload(() => {
     *
     * const aud_player_jump = new BrioAudio("aud_player_jump", "./audios/player_jump.mp3");
     * return [aud_player_jump]; // now the "aud_player_jump" BrioAudio can be used in the 'load' step
     * });
     */
    constructor(name, src) {
        this.#name = name;
        this.#src = src;
        this.#element = new Audio(this.#src);
    }
    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */
    /**
     * Returns the name of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.name); // aud_player_jump
     */
    get name() {
        return this.#name;
    }
    /**
     * Returns the source URL of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.src); // player_jump.mp3
     */
    get src() {
        return this.#src;
    }
    /**
     * Returns the element of the BrioAudio object
     * @example const aud = new BrioAudio("aud_player_jump", "./player_jump.mp3");
     * console.log(aud.element); // <audio preload="auto" src="./player_jump.mp3">
     */
    get element() {
        return this.#element;
    }
    /**
     * Returns the duration of the audio, in seconds, used in the BrioAudio object
     * @example const aud = new BrioAudio("aud_main_song", "./main_song.mp3");
     * console.log(aud.duration); // 242.03 (duration of 2 minutes and 2 seconds)
     */
    get duration() {
        return Math.round(this.#element.duration * 100) / 100;
    }
    /**
     * PUBLIC METHODS -------------------------------------------------------------------
     */
    /**
     * When correctly preloaded, plays the audio once
     * @example game.load((loader) => {
     *
     * const aud = loader.preloaded("aud_player_jump");
     * aud.playOnce(); // plays the audio once as soon as the audio is ready
     * })
     */
    playOnce() {
        this.#element.loop = false;
        if (this.#element.paused) {
            this.#element.play();
        }
    }
    /**
     * When correctly preloaded, plays the audio from the second it was specified.
     * Using this method does not change the sound, so in a playLoop method
     * the second replay would just ignore the time that was specified.
     * @example game.load((loader) => {
     *
     * const aud = loader.preloaded("aud_main_song");
     * aud.playFromTime(20); // skips the first 20 seconds of the sound specified
     * })
     */
    playFromTime(timeInSeconds) {
        if (this.#element.paused) {
            this.#element.currentTime = timeInSeconds;
            this.#element.play();
        }
    }
    /**
     * Plays the audio the amount of times it was specified
     * @example game.load((loader) => {
     *
     * const aud = loader.preloaded("aud_player_punch");
     * aud.playMany(5); // plays the audio 5 times in sequence
     * })
     */
    playMany(iterations, delay) {
        let playCount = 0;
        const handleEnded = () => {
            playCount++;
            if (playCount < iterations - 1) {
                this.#element.currentTime = 0;
                this.#element.play();
            }
            else if (playCount === iterations - 1) {
                this.#element.currentTime = 0;
                this.#element.play();
                this.#element.removeEventListener("ended", handleEnded);
            }
        };
        // plays the sound for the first time
        this.#element.play();
        // checks if a delay was given and then listens for the end of the first play
        if (!delay) {
            this.#element.addEventListener("ended", handleEnded);
        }
        else {
            this.#element.addEventListener("ended", () => {
                setTimeout(() => {
                    handleEnded();
                }, delay);
            });
        }
    }
    /**
     * When correctly preloaded, plays the audio on a loop
     * @example game.load((loader) => {
     *
     * const aud = loader.preloaded("aud_player_punch");
     * aud.playLoop(); // plays the audio indefinitely in sequence
     * })
     */
    playLoop() {
        if (this.#element.paused) {
            this.#element.loop = true;
            this.#element.play();
        }
    }
    /**
     * Pauses the audio if currently playing
     * @example
     * const aud = loader.preloaded("aud_background_ambience");
     * aud.playLoop(); // plays the audio on a loop
     *
     * setTimeout(() => {
     * aud.pause();
     * }, 60 * 1000); // pauses the audio after 60 seconds
     * })
     */
    pause() {
        if (!this.#element.paused) {
            this.#element.pause();
        }
    }
    /**
     * Resumes the audio if currently paused
     * @example
     * const aud = loader.preloaded("aud_background_ambience");
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
    resume() {
        if (this.#element.paused) {
            this.#element.play();
        }
    }
    /**
     * When correctly preloaded, plays the audio many times at the sime time
     * @example game.load((loader) => {
     *
     * const aud = loader.preloaded("aud_explosion");
     * aud.playManyAtTime(3); // plays the audio indefinitely
     * })
     */
    playManyAtTime(quantity) {
        for (let i = 0; i < quantity; i++) {
            this.#element.currentTime = 0;
            this.#element.play();
        }
    }
    /**
     * STATIC METHODS -------------------------------------------------------------------
     */
    /**
     * @typedef {object} PlayTogetherConfigObject
     * @property {"once" | "loop" | "many"} [iterationType] // The iteration type used ("once", "loop", "many")
     * @property {number} [iterationQuantity] // The quantity of iterations when using iterationType: "many"
     */
    /**
     * Play many audios at the same time
     * @param {BrioAudio[]} audios An array of BrioAudio objects to iterate through at the same time
     * @param {PlayTogetherConfigObject} [configurationObject] A configuration object for configuring iteration and timing of the audios
     *
     * @example game.load((loader) => {
     *
     * const aud_1 = loader.preloaded("aud_fire");
     * const aud_2 = loader.preloaded("aud_explosion")
     *
     * BrioAudio.playTogether([aud_1, aud_2]); // plays the 2 audios (only once by default)
     */
    static playTogether(audios, configurationObject) {
        if (!configurationObject) {
            audios.forEach((audio) => {
                audio.playOnce();
            });
            return;
        }
        switch (configurationObject.iterationType) {
            case "once":
                audios.forEach((audio) => {
                    audio.playOnce();
                });
                break;
            case "loop":
                audios.forEach((audio) => {
                    audio.playLoop();
                });
                break;
            case "many":
                if (!configurationObject.iterationQuantity ||
                    typeof configurationObject.iterationQuantity != "number" ||
                    configurationObject.iterationQuantity < 1) {
                    throw new Error("Error iterating through audios: when using iterationType: 'many' you need to add iterationQuantity: [value greater than 0]");
                }
                audios.forEach((audio) => {
                    if (configurationObject.iterationQuantity) {
                        audio.playMany(configurationObject.iterationQuantity);
                    }
                });
                break;
            default:
                throw new Error("Error playing through audios: iterationType should be 'once', 'loop' or 'many'");
                break;
        }
    }
    static playInSequence(audios) {
        if (!audios || audios.length === 0 || !Array.isArray(audios)) {
            throw new Error("playInSequence method shoud receive an Array of BrioAudio objects");
        }
        // creating audio promise
        const playSingleAudio = (audio) => {
            return new Promise((resolve) => {
                const onEnded = () => cleanup();
                const onError = () => cleanup();
                const cleanup = () => {
                    audio.removeEventListener("ended", onEnded);
                    audio.removeEventListener("error", onError);
                    resolve();
                };
                audio.currentTime = 0;
                audio.addEventListener("ended", onEnded, { once: true });
                audio.addEventListener("error", onError, { once: true });
                audio.play().catch(cleanup);
            });
        };
        const playNext = async (index) => {
            if (index >= audios.length)
                return;
            await playSingleAudio(audios[index].#element);
            await playNext(index + 1);
        };
        return playNext(0);
    }
    static getEmptyInstance() {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioAudio("", "");
            this.#emptyInstance = instance;
            return this.#emptyInstance;
        }
        else {
            return this.#emptyInstance;
        }
    }
}
