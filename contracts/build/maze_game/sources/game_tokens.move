module maze_game::game_tokens {
    use std::signer;
    use std::string::String;
    use aptos_framework::event;

    // Error codes
    const ENOT_ENOUGH_TOKENS: u64 = 1;
    const EINVALID_SABOTAGE: u64 = 2;
    const ENO_GAME_ACTIVE: u64 = 3;
    const EINSUFFICIENT_BALANCE: u64 = 4;
    const ECOOLDOWN_ACTIVE: u64 = 5;

    // Sabotage types
    const SABOTAGE_SLOW: u64 = 1;
    const SABOTAGE_BLOCK: u64 = 2;
    const SABOTAGE_DAMAGE: u64 = 3;
    const SABOTAGE_ENEMY: u64 = 4;

    // Sabotage costs in tokens
    const COST_SLOW: u64 = 50;
    const COST_BLOCK: u64 = 75;
    const COST_DAMAGE: u64 = 100;
    const COST_ENEMY: u64 = 125;

    // Cooldown periods in seconds
    const COOLDOWN_SLOW: u64 = 10;
    const COOLDOWN_BLOCK: u64 = 15;
    const COOLDOWN_DAMAGE: u64 = 12;
    const COOLDOWN_ENEMY: u64 = 20;

    // Resource to store user's game tokens
    struct GameTokens has key {
        tokens: u64,
    }

    // Resource to store user's sabotage cooldowns
    struct SabotageCooldowns has key {
        slow_cooldown: u64,
        block_cooldown: u64,
        damage_cooldown: u64,
        enemy_cooldown: u64,
    }

    // Resource to store game state
    struct GameState has key {
        is_active: bool,
        current_room: String,
        last_updated: u64,
    }

    // Events
    #[event]
    struct TokensEarned has drop, store {
        account: address,
        amount: u64,
        reason: String,
    }

    #[event]
    struct TokensSpent has drop, store {
        account: address,
        amount: u64,
        sabotage_type: u64,
        room_id: String,
    }

    #[event]
    struct TokensTransferred has drop, store {
        from: address,
        to: address,
        amount: u64,
        reason: String,
    }

    #[event]
    struct SabotageExecuted has drop, store {
        account: address,
        sabotage_type: u64,
        room_id: String,
        timestamp: u64,
    }

    #[event]
    struct GameStarted has drop, store {
        room_id: String,
        timestamp: u64,
    }

    #[event]
    struct GameEnded has drop, store {
        room_id: String,
        result: String,
        timestamp: u64,
    }

    // Initialize user account with game tokens
    public entry fun initialize_account(account: signer) {
        let account_addr = signer::address_of(&account);
        
        if (!exists<GameTokens>(account_addr)) {
            move_to(&account, GameTokens {
                tokens: 1000, // Starting tokens
            });
        };

        if (!exists<SabotageCooldowns>(account_addr)) {
            move_to(&account, SabotageCooldowns {
                slow_cooldown: 0,
                block_cooldown: 0,
                damage_cooldown: 0,
                enemy_cooldown: 0,
            });
        };
    }

    // Get user's token balance
    #[view]
    public fun get_token_balance(addr: address): u64 acquires GameTokens {
        if (exists<GameTokens>(addr)) {
            borrow_global<GameTokens>(addr).tokens
        } else {
            0
        }
    }

    // Get user's sabotage cooldowns
    #[view]
    public fun get_sabotage_cooldowns(addr: address): (u64, u64, u64, u64) acquires SabotageCooldowns {
        if (exists<SabotageCooldowns>(addr)) {
            let cooldowns = borrow_global<SabotageCooldowns>(addr);
            (cooldowns.slow_cooldown, cooldowns.block_cooldown, cooldowns.damage_cooldown, cooldowns.enemy_cooldown)
        } else {
            (0, 0, 0, 0)
        }
    }

    // Earn tokens (called by game system)
    public entry fun earn_tokens(account: signer, amount: u64, reason: String) acquires GameTokens {
        let account_addr = signer::address_of(&account);
        
        if (!exists<GameTokens>(account_addr)) {
            initialize_account(account);
        };

        let tokens = borrow_global_mut<GameTokens>(account_addr);
        tokens.tokens = tokens.tokens + amount;

        event::emit(TokensEarned {
            account: account_addr,
            amount,
            reason,
        });
    }

    // Transfer tokens to another user
    public entry fun transfer_tokens(
        from_account: signer,
        to_address: address,
        amount: u64,
        reason: String
    ) acquires GameTokens {
        let from_addr = signer::address_of(&from_account);

        // Ensure sender account is initialized
        if (!exists<GameTokens>(from_addr)) {
            initialize_account(from_account);
        };

        // Check if sender has enough tokens and deduct
        let from_tokens_ref = borrow_global_mut<GameTokens>(from_addr);
        assert!(from_tokens_ref.tokens >= amount, EINSUFFICIENT_BALANCE);
        from_tokens_ref.tokens = from_tokens_ref.tokens - amount;

        // Ensure recipient account exists and credit tokens
        assert!(exists<GameTokens>(to_address), ENOT_ENOUGH_TOKENS);
        let to_tokens_ref = borrow_global_mut<GameTokens>(to_address);
        to_tokens_ref.tokens = to_tokens_ref.tokens + amount;

        event::emit(TokensTransferred {
            from: from_addr,
            to: to_address,
            amount,
            reason,
        });
    }

    // Execute sabotage action
    public entry fun execute_sabotage(
        account: signer,
        sabotage_type: u64,
        room_id: String,
        current_timestamp: u64
    ) acquires GameTokens, SabotageCooldowns {
        let account_addr = signer::address_of(&account);
        
        // Ensure account is initialized
        if (!exists<GameTokens>(account_addr)) {
            initialize_account(account);
        };

        let tokens = borrow_global_mut<GameTokens>(account_addr);
        let cooldowns = borrow_global_mut<SabotageCooldowns>(account_addr);

        // Check if user has enough tokens
        let cost = get_sabotage_cost(sabotage_type);
        assert!(tokens.tokens >= cost, EINSUFFICIENT_BALANCE);

        // Check cooldown
        let cooldown_end = get_sabotage_cooldown_end(cooldowns, sabotage_type);
        assert!(current_timestamp >= cooldown_end, ECOOLDOWN_ACTIVE);

        // Deduct tokens
        tokens.tokens = tokens.tokens - cost;

        // Set cooldown
        let cooldown_duration = get_sabotage_cooldown_duration(sabotage_type);
        set_sabotage_cooldown(cooldowns, sabotage_type, current_timestamp + cooldown_duration);

        // Emit events
        event::emit(TokensSpent {
            account: account_addr,
            amount: cost,
            sabotage_type,
            room_id,
        });

        event::emit(SabotageExecuted {
            account: account_addr,
            sabotage_type,
            room_id,
            timestamp: current_timestamp,
        });
    }

    // Start a new game
    public entry fun start_game(room_id: String, timestamp: u64) acquires GameState {
        let game_state = borrow_global_mut<GameState>(@maze_game);
        game_state.is_active = true;
        game_state.current_room = room_id;
        game_state.last_updated = timestamp;

        event::emit(GameStarted {
            room_id,
            timestamp,
        });
    }

    // End current game
    public entry fun end_game(result: String, timestamp: u64) acquires GameState {
        let game_state = borrow_global_mut<GameState>(@maze_game);
        game_state.is_active = false;

        event::emit(GameEnded {
            room_id: game_state.current_room,
            result,
            timestamp,
        });
    }

    // Get current game state
    #[view]
    public fun get_game_state(): (bool, String, u64) acquires GameState {
        let game_state = borrow_global<GameState>(@maze_game);
        (game_state.is_active, game_state.current_room, game_state.last_updated)
    }

    // Helper functions
    fun get_sabotage_cost(sabotage_type: u64): u64 {
        if (sabotage_type == SABOTAGE_SLOW) {
            COST_SLOW
        } else if (sabotage_type == SABOTAGE_BLOCK) {
            COST_BLOCK
        } else if (sabotage_type == SABOTAGE_DAMAGE) {
            COST_DAMAGE
        } else if (sabotage_type == SABOTAGE_ENEMY) {
            COST_ENEMY
        } else {
            0
        }
    }

    fun get_sabotage_cooldown_duration(sabotage_type: u64): u64 {
        if (sabotage_type == SABOTAGE_SLOW) {
            COOLDOWN_SLOW
        } else if (sabotage_type == SABOTAGE_BLOCK) {
            COOLDOWN_BLOCK
        } else if (sabotage_type == SABOTAGE_DAMAGE) {
            COOLDOWN_DAMAGE
        } else if (sabotage_type == SABOTAGE_ENEMY) {
            COOLDOWN_ENEMY
        } else {
            0
        }
    }

    fun get_sabotage_cooldown_end(cooldowns: &SabotageCooldowns, sabotage_type: u64): u64 {
        if (sabotage_type == SABOTAGE_SLOW) {
            cooldowns.slow_cooldown
        } else if (sabotage_type == SABOTAGE_BLOCK) {
            cooldowns.block_cooldown
        } else if (sabotage_type == SABOTAGE_DAMAGE) {
            cooldowns.damage_cooldown
        } else if (sabotage_type == SABOTAGE_ENEMY) {
            cooldowns.enemy_cooldown
        } else {
            0
        }
    }

    fun set_sabotage_cooldown(cooldowns: &mut SabotageCooldowns, sabotage_type: u64, end_time: u64) {
        if (sabotage_type == SABOTAGE_SLOW) {
            cooldowns.slow_cooldown = end_time;
        } else if (sabotage_type == SABOTAGE_BLOCK) {
            cooldowns.block_cooldown = end_time;
        } else if (sabotage_type == SABOTAGE_DAMAGE) {
            cooldowns.damage_cooldown = end_time;
        } else if (sabotage_type == SABOTAGE_ENEMY) {
            cooldowns.enemy_cooldown = end_time;
        };
    }

    // Test functions
    #[test(account = @0x1)]
    public entry fun test_initialize_account(account: signer) acquires GameTokens, SabotageCooldowns {
        let addr = signer::address_of(&account);
        account::create_account_for_test(addr);
        
        initialize_account(account);
        
        assert!(get_token_balance(addr) == 1000, ENOT_ENOUGH_TOKENS);
        let (slow, block, damage, enemy) = get_sabotage_cooldowns(addr);
        assert!(slow == 0 && block == 0 && damage == 0 && enemy == 0, EINVALID_SABOTAGE);
    }

    #[test(account = @0x1)]
    public entry fun test_execute_sabotage(account: signer) acquires GameTokens, SabotageCooldowns {
        let addr = signer::address_of(&account);
        account::create_account_for_test(addr);
        
        initialize_account(account);
        execute_sabotage(account, SABOTAGE_SLOW, string::utf8(b"test_room"), 1000);
        
        assert!(get_token_balance(addr) == 950, ENOT_ENOUGH_TOKENS); // 1000 - 50
    }
} 