module maze_game::room_registry {
    use std::signer;
    use std::string::String;

    struct PlayerRoom has key {
        room_id: String,
        player: address,
    }

    public entry fun attach_player_wallet(account: &signer, room_id: String) {
        if (exists<PlayerRoom>(signer::address_of(account))) {
            move_from<PlayerRoom>(signer::address_of(account));
        }
        move_to(account, PlayerRoom { room_id, player: signer::address_of(account) });
    }

    public fun get_player_wallet(player: address, room_id: String): address {
        let mapping = borrow_global<PlayerRoom>(player);
        if (mapping.room_id == room_id) {
            return mapping.player;
        }
        abort 1;
    }
}