
CREATE TABLE IF NOT EXISTS public.areas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.productos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    area_id BIGINT REFERENCES public.areas(id)
        ON DELETE SET NULL,
    cantidad NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (cantidad >= 0),
    precio NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (precio >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.movimientos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    producto_id BIGINT REFERENCES public.productos(id)
        ON DELETE CASCADE,
    tipo TEXT NOT NULL
        CHECK (tipo IN ('entrada', 'salida')),
    cantidad NUMERIC(12,2) NOT NULL
        CHECK (cantidad > 0),
    nota TEXT,
    fecha TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.areas, public.productos, public.movimientos
TO anon, authenticated;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated;
