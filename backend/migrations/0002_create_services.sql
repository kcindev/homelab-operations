CREATE TABLE services (
    id UUID PRIMARY KEY,
    server_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT services_server_id_fkey
        FOREIGN KEY (server_id)
        REFERENCES servers(id)
        ON DELETE RESTRICT,

    CONSTRAINT services_name_not_blank
        CHECK (name ~ '[^[:space:]]'),

    CONSTRAINT services_server_id_name_key
        UNIQUE (server_id, name)
);