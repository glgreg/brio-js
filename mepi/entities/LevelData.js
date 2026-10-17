/**
 * Level definitions and stage layout configurations for Mepi Platformer.
 * Uses pixel-perfect modular ground blocks and floating platforms.
 */

export const LEVELS = [
    {
        id: 1,
        title: "Green Meadows",
        background: "linear-gradient(to bottom, #3a7bd5 0%, #3a6073 100%)",
        playerStart: { x: 40, y: 260 },
        platforms: [
            // Solid Ground Chunks with lush green grass top
            { sprite: "spr_ground_grass_224x64", x: 0, y: 296, width: 224, height: 64 },
            { sprite: "spr_ground_grass_160x64", x: 288, y: 296, width: 160, height: 64 },
            { sprite: "spr_ground_grass_128x64", x: 512, y: 296, width: 128, height: 64 },

            // Floating Stepping Platforms (16px tiled)
            { sprite: "spr_plat_grass_64", x: 90, y: 230, width: 64, height: 16 },
            { sprite: "spr_plat_grass_64", x: 170, y: 170, width: 64, height: 16 },
            { sprite: "spr_plat_grass_80", x: 260, y: 120, width: 80, height: 16 },
            { sprite: "spr_plat_grass_64", x: 380, y: 180, width: 64, height: 16 },

            // Moving platform bridging the gap between sections
            {
                sprite: "spr_plat_sand_64",
                x: 450,
                y: 250,
                width: 64,
                height: 16,
                isMoving: true,
                moveRange: 32,
                moveSpeed: 35,
                moveAxis: "x",
            },
        ],
        decorations: [
            // Grass tufts, bushes, flowers and mushrooms on the ground
            { sprite: "spr_decor_grass_tuft", x: 70, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_flowers", x: 180, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_bush", x: 200, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_grass_tuft", x: 300, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_mushroom", x: 420, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_bush", x: 520, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_grass_tuft", x: 550, y: 280, width: 16, height: 16 },
            { sprite: "spr_tile_sign", x: 20, y: 280, width: 16, height: 16 },
        ],
        enemies: [
            { type: "green", x: 130, y: 272, patrolRange: 45 },
            { type: "green", x: 350, y: 272, patrolRange: 40 },
        ],
        collectibles: [
            // Coins on stepping paths
            { type: "coin", x: 114, y: 204 },
            { type: "coin", x: 194, y: 144 },
            { type: "coin", x: 292, y: 94 },
            { type: "coin", x: 404, y: 154 },
            { type: "coin", x: 310, y: 270 },
            { type: "coin", x: 340, y: 270 },
            { type: "coin", x: 370, y: 270 },

            // Bonus Fruits
            { type: "fruit", fruitName: "apple", x: 300, y: 92 },
            { type: "fruit", fruitName: "cherry", x: 536, y: 268 },
        ],
        hazards: [
            { sprite: "spr_tile_spikes", x: 240, y: 342, width: 32, height: 18 },
            { sprite: "spr_tile_spikes", x: 464, y: 342, width: 32, height: 18 },
        ],
        goal: {
            sprite: "spr_goal_gate",
            x: 580,
            y: 248,
            width: 32,
            height: 48,
        },
    },
    {
        id: 2,
        title: "Slime Caverns",
        background: "linear-gradient(to bottom, #141e30 0%, #243b55 100%)",
        playerStart: { x: 40, y: 260 },
        platforms: [
            // Start platform
            { sprite: "spr_ground_stone_144x64", x: 0, y: 296, width: 144, height: 64 },

            // Lower cavern floor with hazards
            { sprite: "spr_ground_stone_256x48", x: 192, y: 312, width: 256, height: 48 },

            // Goal high fortress ledge
            { sprite: "spr_ground_stone_128x128", x: 512, y: 232, width: 128, height: 128 },

            // Floating ice and stone stepping platforms
            { sprite: "spr_plat_stone_64", x: 140, y: 240, width: 64, height: 16 },
            { sprite: "spr_plat_ice_64", x: 230, y: 180, width: 64, height: 16 },
            { sprite: "spr_plat_stone_80", x: 320, y: 120, width: 80, height: 16 },
            { sprite: "spr_plat_ice_64", x: 420, y: 170, width: 64, height: 16 },

            // Vertical elevator platform
            {
                sprite: "spr_plat_ice_64",
                x: 100,
                y: 160,
                width: 64,
                height: 16,
                isMoving: true,
                moveRange: 45,
                moveSpeed: 35,
                moveAxis: "y",
            },
        ],
        decorations: [
            { sprite: "spr_decor_mushroom", x: 60, y: 280, width: 16, height: 16 },
            { sprite: "spr_decor_mushroom", x: 220, y: 296, width: 16, height: 16 },
            { sprite: "spr_decor_mushroom", x: 380, y: 296, width: 16, height: 16 },
        ],
        enemies: [
            { type: "green", x: 230, y: 288, patrolRange: 35 },
            { type: "purple", x: 350, y: 288, patrolRange: 50 },
            { type: "purple", x: 350, y: 96, patrolRange: 25 },
        ],
        collectibles: [
            { type: "coin", x: 164, y: 214 },
            { type: "coin", x: 254, y: 154 },
            { type: "coin", x: 344, y: 94 },
            { type: "coin", x: 444, y: 144 },
            { type: "coin", x: 220, y: 286 },
            { type: "coin", x: 280, y: 286 },
            { type: "coin", x: 400, y: 286 },

            // Power Fruits
            { type: "fruit", fruitName: "banana", x: 360, y: 92 },
            { type: "fruit", fruitName: "strawberry", x: 124, y: 110 },
        ],
        hazards: [
            { sprite: "spr_tile_spikes", x: 152, y: 342, width: 32, height: 18 },
            { sprite: "spr_tile_spikes", x: 460, y: 342, width: 32, height: 18 },
        ],
        goal: {
            sprite: "spr_goal_gate",
            x: 570,
            y: 184,
            width: 32,
            height: 48,
        },
    },
    {
        id: 3,
        title: "Castle Fortress",
        background: "linear-gradient(to bottom, #0f2027 0%, #203a43 50%, #2c5364 100%)",
        playerStart: { x: 30, y: 260 },
        platforms: [
            // Multi-segment ground with hazard pits
            { sprite: "spr_ground_stone_112x64", x: 0, y: 296, width: 112, height: 64 },
            { sprite: "spr_ground_stone_112x64", x: 160, y: 296, width: 112, height: 64 },
            { sprite: "spr_ground_stone_112x64", x: 320, y: 296, width: 112, height: 64 },

            // High fortress gate tower
            { sprite: "spr_ground_stone_128x128", x: 512, y: 168, width: 128, height: 192 },

            // Floating stone ledges
            { sprite: "spr_plat_stone_64", x: 80, y: 230, width: 64, height: 16 },
            { sprite: "spr_plat_stone_64", x: 200, y: 180, width: 64, height: 16 },
            { sprite: "spr_plat_stone_80", x: 320, y: 130, width: 80, height: 16 },

            // Moving sky platform towards the tower
            {
                sprite: "spr_plat_ice_64",
                x: 420,
                y: 100,
                width: 64,
                height: 16,
                isMoving: true,
                moveRange: 35,
                moveSpeed: 40,
                moveAxis: "x",
            },
        ],
        decorations: [
            { sprite: "spr_tile_flag", x: 80, y: 214, width: 16, height: 16 },
            { sprite: "spr_tile_flag", x: 200, y: 164, width: 16, height: 16 },
            { sprite: "spr_tile_flag", x: 516, y: 152, width: 16, height: 16 },
        ],
        enemies: [
            { type: "green", x: 50, y: 272, patrolRange: 25 },
            { type: "purple", x: 200, y: 272, patrolRange: 30 },
            { type: "purple", x: 360, y: 272, patrolRange: 30 },
            { type: "purple", x: 220, y: 156, patrolRange: 20 },
        ],
        collectibles: [
            { type: "coin", x: 104, y: 204 },
            { type: "coin", x: 224, y: 154 },
            { type: "coin", x: 344, y: 104 },
            { type: "coin", x: 444, y: 74 },
            { type: "coin", x: 180, y: 270 },
            { type: "coin", x: 340, y: 270 },

            // Rare Golden Pineapple & Melon
            { type: "fruit", fruitName: "pineapple", x: 360, y: 102 },
            { type: "fruit", fruitName: "melon", x: 536, y: 140 },
        ],
        hazards: [
            { sprite: "spr_tile_spikes", x: 120, y: 342, width: 32, height: 18 },
            { sprite: "spr_tile_spikes", x: 280, y: 342, width: 32, height: 18 },
            { sprite: "spr_tile_spikes", x: 440, y: 342, width: 64, height: 18 },
        ],
        goal: {
            sprite: "spr_goal_gate",
            x: 570,
            y: 120,
            width: 32,
            height: 48,
        },
    },
];
