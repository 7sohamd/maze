module maze_game::room_registry {
    use std::signer;
    use std::string::String;
    use aptos_std::table::{Table, new, add, borrow};

    struct RoomPlayerMap has key {
        map: Table<String, address>,
    }

    public entry fun init_registry(account: &signer) {
        if (!exists<RoomPlayerMap>(signer::address_of(account))) {
            let _unused = move_to(account, RoomPlayerMap { map: new<String, address>() });
        }
    }

    public entry fun attach_player_wallet(account: &signer, room_id: String) acquires RoomPlayerMap {
        let addr = signer::address_of(account);
        let registry = borrow_global_mut<RoomPlayerMap>(@maze_game);
        add(&mut registry.map, room_id, addr);
    }

    public fun get_player_wallet(room_id: String): address acquires RoomPlayerMap {
        let registry = borrow_global<RoomPlayerMap>(@maze_game);
        *borrow(&registry.map, room_id)
    }
}