CREATE TABLE servers (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    hostname VARCHAR(253),
    ip_address INET,
    operating_system VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT servers_name_not_blank
        CHECK (btrim(name) <> '')
);