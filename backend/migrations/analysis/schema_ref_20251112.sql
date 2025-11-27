--
-- PostgreSQL database dump
--

\restrict qg7Hd0Z1qaI4uy1R72eeZUd0gTCftiErUE4Zf2d4z0fE4iQpCtLoo6mHbKufNQt

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: econtrole
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO econtrole;

--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: alvara_funcionamento_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.alvara_funcionamento_enum AS ENUM (
    'CONDICIONADO',
    'PROVIS├ôRIO',
    'DEFINITIVO'
);


ALTER TYPE public.alvara_funcionamento_enum OWNER TO econtrole;

--
-- Name: categoria_contato_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.categoria_contato_enum AS ENUM (
    'BOMBEIROS',
    'POSTURA',
    'AMBIENTAL/USO DO SOLO',
    'VISA'
);


ALTER TYPE public.categoria_contato_enum OWNER TO econtrole;

--
-- Name: notificacao_sanitaria_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.notificacao_sanitaria_enum AS ENUM (
    'ÔÇô',
    'POSSUI PEND├èNCIAS',
    'SEM PEND├èNCIAS',
    'RESOLVIDAS',
    'PEGAR ORIGINAL'
);


ALTER TYPE public.notificacao_sanitaria_enum OWNER TO econtrole;

--
-- Name: operacao_diversos_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.operacao_diversos_enum AS ENUM (
    'ALTERA├ç├âO',
    'INSCRI├ç├âO',
    'BAIXA',
    'CANCEL DE TRIBUTOS',
    'RESTITUI├ç├âO',
    'RETIFICA├ç├âO'
);


ALTER TYPE public.operacao_diversos_enum OWNER TO econtrole;

--
-- Name: orgao_diversos_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.orgao_diversos_enum AS ENUM (
    'PREFEITURA',
    'ANP',
    'RFB',
    'CART├ôRIO 2┬║ TABELIONATO'
);


ALTER TYPE public.orgao_diversos_enum OWNER TO econtrole;

--
-- Name: servico_sanitario_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.servico_sanitario_enum AS ENUM (
    '1┬║ ALVAR├ü',
    'RENOVA├ç├âO',
    'ATUALIZA├ç├âO'
);


ALTER TYPE public.servico_sanitario_enum OWNER TO econtrole;

--
-- Name: situacao_processo_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.situacao_processo_enum AS ENUM (
    'AGUARD DOCTO',
    'AGUARD PAGTO',
    'EM AN├üLISE',
    'PENDENTE',
    'INDEFERIDO',
    'CONCLU├ìDO',
    'LICENCIADO',
    'NOTIFICA├ç├âO',
    'AGUARD VISTORIA',
    'AGUARD REGULARIZA├ç├âO',
    'AGUARD LIBERA├ç├âO',
    'IR NA VISA'
);


ALTER TYPE public.situacao_processo_enum OWNER TO econtrole;

--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: econtrole
--

CREATE TYPE public.user_role_enum AS ENUM (
    'OWNER',
    'ADMIN',
    'STAFF',
    'VIEWER'
);


ALTER TYPE public.user_role_enum OWNER TO econtrole;

--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: econtrole
--

CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT public.unaccent($1) $_$;


ALTER FUNCTION public.immutable_unaccent(text) OWNER TO econtrole;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.agendamentos (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    empresa_id integer,
    titulo character varying(255) NOT NULL,
    descricao text,
    inicio timestamp with time zone NOT NULL,
    fim timestamp with time zone,
    tipo character varying(50),
    situacao character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agendamentos OWNER TO econtrole;

--
-- Name: agendamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.agendamentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agendamentos_id_seq OWNER TO econtrole;

--
-- Name: agendamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.agendamentos_id_seq OWNED BY public.agendamentos.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.alembic_version (
    version_num character varying(255) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO econtrole;

--
-- Name: certificados; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.certificados (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    empresa_id integer,
    arquivo character varying(512),
    caminho character varying(1024),
    serial character varying(128),
    sha1 character varying(128),
    subject character varying(1024),
    issuer character varying(1024),
    valido_de date,
    valido_ate date,
    senha character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.certificados OWNER TO econtrole;

--
-- Name: certificados_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.certificados_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.certificados_id_seq OWNER TO econtrole;

--
-- Name: certificados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.certificados_id_seq OWNED BY public.certificados.id;


--
-- Name: contatos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.contatos (
    id integer NOT NULL,
    contato character varying(255) NOT NULL,
    municipio character varying(120),
    telefone character varying(60),
    whatsapp character varying(10) DEFAULT 'N├âO'::character varying NOT NULL,
    email character varying(255),
    categoria public.categoria_contato_enum NOT NULL
);


ALTER TABLE public.contatos OWNER TO econtrole;

--
-- Name: contatos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.contatos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contatos_id_seq OWNER TO econtrole;

--
-- Name: contatos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.contatos_id_seq OWNED BY public.contatos.id;


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.empresas (
    id integer NOT NULL,
    empresa character varying(255) NOT NULL,
    cnpj character varying(14) NOT NULL,
    porte character varying(50),
    municipio character varying(120) NOT NULL,
    status_empresas character varying(50) DEFAULT 'Ativa'::character varying NOT NULL,
    categoria character varying(120),
    ie character varying(50),
    im character varying(50),
    situacao character varying(120),
    debito character varying(120),
    certificado character varying(120),
    obs text,
    proprietario character varying(255),
    cpf character varying(14),
    telefone character varying(60),
    email character varying(255),
    responsavel character varying(255),
    updated_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL,
    created_by integer,
    updated_by integer,
    CONSTRAINT ck_empresas_cnpj_digits_len CHECK ((((cnpj)::text ~ '^[0-9]{11}$'::text) OR ((cnpj)::text ~ '^[0-9]{14}$'::text))),
    CONSTRAINT ck_empresas_cnpj_formato CHECK (((char_length((cnpj)::text) = 14) AND ((cnpj)::text ~ '^[0-9]+$'::text)))
);


ALTER TABLE public.empresas OWNER TO econtrole;

--
-- Name: empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.empresas_id_seq OWNER TO econtrole;

--
-- Name: empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.empresas_id_seq OWNED BY public.empresas.id;


--
-- Name: licencas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.licencas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    status character varying(120) NOT NULL,
    validade date,
    obs text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    org_id uuid NOT NULL,
    created_by integer,
    updated_by integer,
    CONSTRAINT ck_licencas_validade CHECK (((validade IS NULL) OR (validade >= '1900-01-01'::date)))
);


ALTER TABLE public.licencas OWNER TO econtrole;

--
-- Name: licencas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.licencas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.licencas_id_seq OWNER TO econtrole;

--
-- Name: licencas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.licencas_id_seq OWNED BY public.licencas.id;


--
-- Name: modelos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.modelos (
    id integer NOT NULL,
    modelo text NOT NULL,
    descricao character varying(255),
    utilizacao character varying(120) DEFAULT 'WhatsApp'::character varying NOT NULL
);


ALTER TABLE public.modelos OWNER TO econtrole;

--
-- Name: modelos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.modelos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modelos_id_seq OWNER TO econtrole;

--
-- Name: modelos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.modelos_id_seq OWNED BY public.modelos.id;


--
-- Name: orgs; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.orgs (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.orgs OWNER TO econtrole;

--
-- Name: processos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.processos (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    protocolo character varying(120),
    data_solicitacao date,
    situacao public.situacao_processo_enum NOT NULL,
    status_padrao character varying(120),
    obs text,
    prazo date,
    operacao public.operacao_diversos_enum,
    orgao public.orgao_diversos_enum,
    alvara public.alvara_funcionamento_enum,
    municipio character varying(120),
    tpi character varying(120),
    inscricao_imobiliaria character varying(120),
    servico public.servico_sanitario_enum,
    taxa character varying(120),
    notificacao public.notificacao_sanitaria_enum,
    data_val date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    area_m2 numeric(12,2),
    projeto character varying(120),
    org_id uuid NOT NULL,
    created_by integer,
    updated_by integer,
    CONSTRAINT ck_processos_prazo CHECK (((prazo IS NULL) OR (prazo >= data_solicitacao)))
);


ALTER TABLE public.processos OWNER TO econtrole;

--
-- Name: processos_avulsos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.processos_avulsos (
    id integer NOT NULL,
    documento character varying(30) NOT NULL,
    tipo character varying(50) NOT NULL,
    protocolo character varying(120),
    data_solicitacao date,
    situacao public.situacao_processo_enum NOT NULL,
    status_padrao character varying(120),
    obs text,
    operacao public.operacao_diversos_enum,
    orgao public.orgao_diversos_enum,
    alvara public.alvara_funcionamento_enum,
    municipio character varying(120),
    tpi character varying(120),
    inscricao_imobiliaria character varying(120),
    servico public.servico_sanitario_enum,
    taxa character varying(120),
    notificacao public.notificacao_sanitaria_enum,
    data_val date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    area_m2 numeric(12,2),
    projeto character varying(120),
    org_id uuid NOT NULL
);


ALTER TABLE public.processos_avulsos OWNER TO econtrole;

--
-- Name: processos_avulsos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.processos_avulsos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.processos_avulsos_id_seq OWNER TO econtrole;

--
-- Name: processos_avulsos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.processos_avulsos_id_seq OWNED BY public.processos_avulsos.id;


--
-- Name: processos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.processos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.processos_id_seq OWNER TO econtrole;

--
-- Name: processos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.processos_id_seq OWNED BY public.processos.id;


--
-- Name: stg_certificados; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_certificados (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stg_certificados OWNER TO econtrole;

--
-- Name: stg_certificados_agendamentos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_certificados_agendamentos (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stg_certificados_agendamentos OWNER TO econtrole;

--
-- Name: stg_certificados_agendamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_certificados_agendamentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_certificados_agendamentos_id_seq OWNER TO econtrole;

--
-- Name: stg_certificados_agendamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_certificados_agendamentos_id_seq OWNED BY public.stg_certificados_agendamentos.id;


--
-- Name: stg_certificados_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_certificados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_certificados_id_seq OWNER TO econtrole;

--
-- Name: stg_certificados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_certificados_id_seq OWNED BY public.stg_certificados.id;


--
-- Name: stg_empresas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_empresas (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


ALTER TABLE public.stg_empresas OWNER TO econtrole;

--
-- Name: stg_empresas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_empresas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_empresas_id_seq OWNER TO econtrole;

--
-- Name: stg_empresas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_empresas_id_seq OWNED BY public.stg_empresas.id;


--
-- Name: stg_licencas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_licencas (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


ALTER TABLE public.stg_licencas OWNER TO econtrole;

--
-- Name: stg_licencas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_licencas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_licencas_id_seq OWNER TO econtrole;

--
-- Name: stg_licencas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_licencas_id_seq OWNED BY public.stg_licencas.id;


--
-- Name: stg_processos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_processos (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


ALTER TABLE public.stg_processos OWNER TO econtrole;

--
-- Name: stg_processos_avulsos; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_processos_avulsos (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stg_processos_avulsos OWNER TO econtrole;

--
-- Name: stg_processos_avulsos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_processos_avulsos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_processos_avulsos_id_seq OWNER TO econtrole;

--
-- Name: stg_processos_avulsos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_processos_avulsos_id_seq OWNED BY public.stg_processos_avulsos.id;


--
-- Name: stg_processos_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_processos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_processos_id_seq OWNER TO econtrole;

--
-- Name: stg_processos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_processos_id_seq OWNED BY public.stg_processos.id;


--
-- Name: stg_taxas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.stg_taxas (
    id integer NOT NULL,
    run_id character varying(36) NOT NULL,
    file_source character varying(255) NOT NULL,
    row_number integer NOT NULL,
    row_hash character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    org_id uuid NOT NULL
);


ALTER TABLE public.stg_taxas OWNER TO econtrole;

--
-- Name: stg_taxas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.stg_taxas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stg_taxas_id_seq OWNER TO econtrole;

--
-- Name: stg_taxas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.stg_taxas_id_seq OWNED BY public.stg_taxas.id;


--
-- Name: taxas; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.taxas (
    id integer NOT NULL,
    empresa_id integer NOT NULL,
    tipo character varying(50) NOT NULL,
    status character varying(120) NOT NULL,
    data_envio date,
    obs text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    org_id uuid NOT NULL,
    vencimento_tpi date,
    created_by integer,
    updated_by integer
);


ALTER TABLE public.taxas OWNER TO econtrole;

--
-- Name: taxas_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.taxas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxas_id_seq OWNER TO econtrole;

--
-- Name: taxas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.taxas_id_seq OWNED BY public.taxas.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: econtrole
--

CREATE TABLE public.users (
    id integer NOT NULL,
    org_id uuid NOT NULL,
    email character varying(320) NOT NULL,
    name character varying(200) NOT NULL,
    role public.user_role_enum DEFAULT 'OWNER'::public.user_role_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO econtrole;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: econtrole
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO econtrole;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: econtrole
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: v_alertas_vencendo_30d; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_alertas_vencendo_30d AS
 WITH base AS (
         SELECT e.org_id,
            e.id AS empresa_id,
            e.empresa,
            e.cnpj,
            'LICENCA'::text AS tipo_alerta,
            (((l.tipo)::text || ' - '::text) || (COALESCE(l.status, '?'::character varying))::text) AS descricao,
            l.validade,
            (l.validade - CURRENT_DATE) AS dias_restantes
           FROM (public.licencas l
             JOIN public.empresas e ON (((e.id = l.empresa_id) AND (e.org_id = l.org_id))))
          WHERE (((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid)) AND (l.validade IS NOT NULL) AND (l.validade <= (CURRENT_DATE + '30 days'::interval)))
        UNION ALL
         SELECT e.org_id,
            e.id AS empresa_id,
            e.empresa,
            e.cnpj,
            'TAXA'::text AS tipo_alerta,
            ('TPI - '::text || (COALESCE(t.status, '?'::character varying))::text) AS descricao,
            t.vencimento_tpi AS validade,
                CASE
                    WHEN (t.vencimento_tpi IS NULL) THEN NULL::integer
                    ELSE (t.vencimento_tpi - CURRENT_DATE)
                END AS dias_restantes
           FROM (public.taxas t
             JOIN public.empresas e ON (((e.id = t.empresa_id) AND (e.org_id = t.org_id))))
          WHERE (((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid)) AND (t.vencimento_tpi IS NOT NULL) AND (lower((COALESCE(t.status, ''::character varying))::text) !~~ 'pago%'::text))
        UNION ALL
         SELECT e.org_id,
            e.id AS empresa_id,
            e.empresa,
            e.cnpj,
            'PROCESSO'::text AS tipo_alerta,
            (((p.tipo)::text || ' - '::text) || (p.situacao)::text) AS descricao,
            p.prazo AS validade,
                CASE
                    WHEN (p.prazo IS NULL) THEN NULL::integer
                    ELSE (p.prazo - CURRENT_DATE)
                END AS dias_restantes
           FROM (public.processos p
             JOIN public.empresas e ON (((e.id = p.empresa_id) AND (e.org_id = p.org_id))))
          WHERE (((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid)) AND (p.prazo IS NOT NULL) AND (p.prazo <= (CURRENT_DATE + '30 days'::interval)))
        )
 SELECT org_id,
    empresa_id,
    empresa,
    cnpj,
    tipo_alerta,
    descricao,
    validade,
    dias_restantes
   FROM base;


ALTER VIEW public.v_alertas_vencendo_30d OWNER TO econtrole;

--
-- Name: v_certificados_status; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_certificados_status AS
 SELECT c.id AS cert_id,
    e.id AS empresa_id,
    e.org_id,
    e.empresa,
    e.cnpj,
    c.valido_de,
    c.valido_ate,
    GREATEST(0, (c.valido_ate - CURRENT_DATE)) AS dias_restantes,
        CASE
            WHEN (c.valido_ate IS NULL) THEN 'INDEFINIDO'::text
            WHEN (c.valido_ate < CURRENT_DATE) THEN 'VENCIDO'::text
            WHEN (c.valido_ate <= (CURRENT_DATE + '7 days'::interval)) THEN 'VENCE EM 7 DIAS'::text
            WHEN (c.valido_ate <= (CURRENT_DATE + '30 days'::interval)) THEN 'VENCE EM 30 DIAS'::text
            ELSE 'V├üLIDO'::text
        END AS situacao
   FROM (public.certificados c
     LEFT JOIN public.empresas e ON (((e.id = c.empresa_id) AND (e.org_id = c.org_id))))
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid));


ALTER VIEW public.v_certificados_status OWNER TO econtrole;

--
-- Name: v_empresas; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_empresas AS
 SELECT e.id AS empresa_id,
    e.org_id,
    e.empresa,
    e.cnpj,
    e.municipio,
    e.porte,
    e.categoria,
    e.situacao,
    e.status_empresas,
    e.debito,
    e.certificado,
    COALESCE(count(DISTINCT l.id) FILTER (WHERE (l.id IS NOT NULL)), (0)::bigint) AS total_licencas,
    COALESCE(count(DISTINCT t.id) FILTER (WHERE (t.id IS NOT NULL)), (0)::bigint) AS total_taxas,
    COALESCE(count(DISTINCT p.id) FILTER (WHERE ((p.prazo IS NULL) OR (p.prazo >= CURRENT_DATE))), (0)::bigint) AS processos_ativos,
    e.updated_at
   FROM (((public.empresas e
     LEFT JOIN public.licencas l ON (((l.empresa_id = e.id) AND (l.org_id = e.org_id))))
     LEFT JOIN public.taxas t ON (((t.empresa_id = e.id) AND (t.org_id = e.org_id))))
     LEFT JOIN public.processos p ON (((p.empresa_id = e.id) AND (p.org_id = e.org_id))))
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid))
  GROUP BY e.id, e.org_id, e.empresa, e.cnpj, e.municipio, e.porte, e.categoria, e.situacao, e.status_empresas, e.debito, e.certificado, e.updated_at;


ALTER VIEW public.v_empresas OWNER TO econtrole;

--
-- Name: v_grupos_kpis; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_grupos_kpis AS
 WITH emp AS (
         SELECT e.org_id,
            count(*) AS total_empresas,
            count(*) FILTER (WHERE (COALESCE(upper(TRIM(BOTH FROM e.certificado)), 'N├âO'::text) = ANY (ARRAY['N├âO'::text, 'NAO'::text, 'N/A'::text, 'N'::text]))) AS sem_certificado
           FROM public.empresas e
          GROUP BY e.org_id
        ), lic_venc AS (
         SELECT l.org_id,
            count(*) FILTER (WHERE ((l.validade IS NOT NULL) AND (l.validade < CURRENT_DATE))) AS licencas_vencidas
           FROM public.licencas l
          GROUP BY l.org_id
        ), tpi_pend AS (
         SELECT t.org_id,
            count(*) FILTER (WHERE ((lower((COALESCE(t.status, ''::character varying))::text) !~~ 'pago%'::text) AND (upper(TRIM(BOTH FROM t.tipo)) = 'TPI'::text))) AS tpi_pendente
           FROM public.taxas t
          GROUP BY t.org_id
        ), unioned AS (
         SELECT emp.org_id,
            'empresas'::text AS grupo,
            'total_empresas'::text AS chave,
            emp.total_empresas AS valor
           FROM emp
        UNION ALL
         SELECT emp.org_id,
            'empresas'::text AS grupo,
            'sem_certificado'::text AS chave,
            emp.sem_certificado AS valor
           FROM emp
        UNION ALL
         SELECT l.org_id,
            'licencas'::text AS grupo,
            'licencas_vencidas'::text AS chave,
            COALESCE(l.licencas_vencidas, (0)::bigint) AS valor
           FROM lic_venc l
        UNION ALL
         SELECT t.org_id,
            'taxas'::text AS grupo,
            'tpi_pendente'::text AS chave,
            COALESCE(t.tpi_pendente, (0)::bigint) AS valor
           FROM tpi_pend t
        )
 SELECT org_id,
    grupo,
    chave,
    valor
   FROM unioned
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (org_id = (current_setting('app.current_org'::text))::uuid));


ALTER VIEW public.v_grupos_kpis OWNER TO econtrole;

--
-- Name: v_licencas_status; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_licencas_status AS
 SELECT l.id AS licenca_id,
    e.id AS empresa_id,
    e.org_id,
    e.empresa,
    e.cnpj,
    e.municipio,
    l.tipo,
    l.status,
    l.validade,
        CASE
            WHEN (l.validade IS NULL) THEN NULL::integer
            ELSE (l.validade - CURRENT_DATE)
        END AS dias_para_vencer
   FROM (public.licencas l
     JOIN public.empresas e ON (((e.id = l.empresa_id) AND (e.org_id = l.org_id))))
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid));


ALTER VIEW public.v_licencas_status OWNER TO econtrole;

--
-- Name: v_processos_resumo; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_processos_resumo AS
 SELECT p.id AS processo_id,
    e.id AS empresa_id,
    p.org_id,
    e.empresa,
    e.cnpj,
    p.tipo,
    p.protocolo,
    p.data_solicitacao,
    p.situacao,
    p.status_padrao,
    p.prazo,
        CASE
            WHEN ((lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%conclu%'::text) OR (lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%licenc%'::text) OR (lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%aprov%'::text)) THEN 'success'::text
            WHEN ((lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%vencid%'::text) OR (lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%indefer%'::text)) THEN 'danger'::text
            WHEN ((lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%aguard%'::text) OR (lower((COALESCE(p.status_padrao, ((p.situacao)::text)::character varying))::text) ~~ '%pend%'::text)) THEN 'warning'::text
            ELSE NULL::text
        END AS status_cor
   FROM (public.processos p
     JOIN public.empresas e ON (((e.id = p.empresa_id) AND (e.org_id = p.org_id))))
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid));


ALTER VIEW public.v_processos_resumo OWNER TO econtrole;

--
-- Name: v_taxas_status; Type: VIEW; Schema: public; Owner: econtrole
--

CREATE VIEW public.v_taxas_status AS
 SELECT t.id AS taxa_id,
    e.id AS empresa_id,
    e.org_id,
    e.empresa,
    e.cnpj,
    e.municipio,
    t.tipo,
    t.status,
    t.data_envio,
    t.vencimento_tpi,
    (lower((COALESCE(t.status, ''::character varying))::text) ~~ 'pago%'::text) AS esta_pago
   FROM (public.taxas t
     JOIN public.empresas e ON (((e.id = t.empresa_id) AND (e.org_id = t.org_id))))
  WHERE ((current_setting('app.current_org'::text, true) IS NULL) OR (e.org_id = (current_setting('app.current_org'::text))::uuid));


ALTER VIEW public.v_taxas_status OWNER TO econtrole;

--
-- Name: agendamentos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.agendamentos ALTER COLUMN id SET DEFAULT nextval('public.agendamentos_id_seq'::regclass);


--
-- Name: certificados id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.certificados ALTER COLUMN id SET DEFAULT nextval('public.certificados_id_seq'::regclass);


--
-- Name: contatos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.contatos ALTER COLUMN id SET DEFAULT nextval('public.contatos_id_seq'::regclass);


--
-- Name: empresas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.empresas ALTER COLUMN id SET DEFAULT nextval('public.empresas_id_seq'::regclass);


--
-- Name: licencas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas ALTER COLUMN id SET DEFAULT nextval('public.licencas_id_seq'::regclass);


--
-- Name: modelos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.modelos ALTER COLUMN id SET DEFAULT nextval('public.modelos_id_seq'::regclass);


--
-- Name: processos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos ALTER COLUMN id SET DEFAULT nextval('public.processos_id_seq'::regclass);


--
-- Name: processos_avulsos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos_avulsos ALTER COLUMN id SET DEFAULT nextval('public.processos_avulsos_id_seq'::regclass);


--
-- Name: stg_certificados id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_certificados ALTER COLUMN id SET DEFAULT nextval('public.stg_certificados_id_seq'::regclass);


--
-- Name: stg_certificados_agendamentos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_certificados_agendamentos ALTER COLUMN id SET DEFAULT nextval('public.stg_certificados_agendamentos_id_seq'::regclass);


--
-- Name: stg_empresas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_empresas ALTER COLUMN id SET DEFAULT nextval('public.stg_empresas_id_seq'::regclass);


--
-- Name: stg_licencas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_licencas ALTER COLUMN id SET DEFAULT nextval('public.stg_licencas_id_seq'::regclass);


--
-- Name: stg_processos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_processos ALTER COLUMN id SET DEFAULT nextval('public.stg_processos_id_seq'::regclass);


--
-- Name: stg_processos_avulsos id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_processos_avulsos ALTER COLUMN id SET DEFAULT nextval('public.stg_processos_avulsos_id_seq'::regclass);


--
-- Name: stg_taxas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_taxas ALTER COLUMN id SET DEFAULT nextval('public.stg_taxas_id_seq'::regclass);


--
-- Name: taxas id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas ALTER COLUMN id SET DEFAULT nextval('public.taxas_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: certificados certificados_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT certificados_pkey PRIMARY KEY (id);


--
-- Name: contatos contatos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: licencas licencas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas
    ADD CONSTRAINT licencas_pkey PRIMARY KEY (id);


--
-- Name: modelos modelos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.modelos
    ADD CONSTRAINT modelos_pkey PRIMARY KEY (id);


--
-- Name: orgs orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.orgs
    ADD CONSTRAINT orgs_pkey PRIMARY KEY (id);


--
-- Name: processos_avulsos processos_avulsos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos_avulsos
    ADD CONSTRAINT processos_avulsos_pkey PRIMARY KEY (id);


--
-- Name: processos processos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT processos_pkey PRIMARY KEY (id);


--
-- Name: stg_certificados_agendamentos stg_certificados_agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_certificados_agendamentos
    ADD CONSTRAINT stg_certificados_agendamentos_pkey PRIMARY KEY (id);


--
-- Name: stg_certificados stg_certificados_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_certificados
    ADD CONSTRAINT stg_certificados_pkey PRIMARY KEY (id);


--
-- Name: stg_empresas stg_empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_empresas
    ADD CONSTRAINT stg_empresas_pkey PRIMARY KEY (id);


--
-- Name: stg_licencas stg_licencas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_licencas
    ADD CONSTRAINT stg_licencas_pkey PRIMARY KEY (id);


--
-- Name: stg_processos_avulsos stg_processos_avulsos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_processos_avulsos
    ADD CONSTRAINT stg_processos_avulsos_pkey PRIMARY KEY (id);


--
-- Name: stg_processos stg_processos_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_processos
    ADD CONSTRAINT stg_processos_pkey PRIMARY KEY (id);


--
-- Name: stg_taxas stg_taxas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.stg_taxas
    ADD CONSTRAINT stg_taxas_pkey PRIMARY KEY (id);


--
-- Name: taxas taxas_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas
    ADD CONSTRAINT taxas_pkey PRIMARY KEY (id);


--
-- Name: certificados uq_certificados_org_serial; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT uq_certificados_org_serial UNIQUE (org_id, serial);


--
-- Name: users uq_users_org_email; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_org_email UNIQUE (org_id, email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_contatos_categoria; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_contatos_categoria ON public.contatos USING btree (categoria);


--
-- Name: idx_empresas_municipio; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_empresas_municipio ON public.empresas USING btree (municipio);


--
-- Name: idx_licencas_empresa_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_licencas_empresa_tipo ON public.licencas USING btree (empresa_id, tipo);


--
-- Name: idx_licencas_validade; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_licencas_validade ON public.licencas USING btree (validade);


--
-- Name: idx_modelos_utilizacao; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_modelos_utilizacao ON public.modelos USING btree (utilizacao);


--
-- Name: idx_processos_empresa_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_processos_empresa_tipo ON public.processos USING btree (empresa_id, tipo);


--
-- Name: idx_processos_prazo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_processos_prazo ON public.processos USING btree (prazo);


--
-- Name: idx_processos_situacao; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_processos_situacao ON public.processos USING btree (situacao);


--
-- Name: idx_stg_certificados_agendamentos_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_certificados_agendamentos_run_id ON public.stg_certificados_agendamentos USING btree (run_id);


--
-- Name: idx_stg_certificados_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_certificados_run_id ON public.stg_certificados USING btree (run_id);


--
-- Name: idx_stg_empresas_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_empresas_run_id ON public.stg_empresas USING btree (run_id);


--
-- Name: idx_stg_licencas_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_licencas_run_id ON public.stg_licencas USING btree (run_id);


--
-- Name: idx_stg_processos_avulsos_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_processos_avulsos_run_id ON public.stg_processos_avulsos USING btree (run_id);


--
-- Name: idx_stg_processos_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_processos_run_id ON public.stg_processos USING btree (run_id);


--
-- Name: idx_stg_taxas_run_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_stg_taxas_run_id ON public.stg_taxas USING btree (run_id);


--
-- Name: idx_taxas_empresa_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_taxas_empresa_tipo ON public.taxas USING btree (empresa_id, tipo);


--
-- Name: idx_taxas_status; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX idx_taxas_status ON public.taxas USING btree (status);


--
-- Name: ix_agendamentos_empresa_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_agendamentos_empresa_id ON public.agendamentos USING btree (empresa_id);


--
-- Name: ix_agendamentos_inicio; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_agendamentos_inicio ON public.agendamentos USING btree (inicio);


--
-- Name: ix_agendamentos_org_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_agendamentos_org_id ON public.agendamentos USING btree (org_id);


--
-- Name: ix_certificados_empresa_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_certificados_empresa_id ON public.certificados USING btree (empresa_id);


--
-- Name: ix_certificados_org_id; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_certificados_org_id ON public.certificados USING btree (org_id);


--
-- Name: ix_certificados_valido_ate; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_certificados_valido_ate ON public.certificados USING btree (valido_ate);


--
-- Name: ix_empresas_org_cnpj; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_empresas_org_cnpj ON public.empresas USING btree (org_id, cnpj);


--
-- Name: ix_empresas_org_empresa_norm; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_empresas_org_empresa_norm ON public.empresas USING btree (org_id, lower(public.immutable_unaccent((empresa)::text)));


--
-- Name: ix_empresas_org_municipio_norm; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_empresas_org_municipio_norm ON public.empresas USING btree (org_id, lower(public.immutable_unaccent((municipio)::text)));


--
-- Name: ix_licencas_org_validade; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_licencas_org_validade ON public.licencas USING btree (org_id, validade);


--
-- Name: ix_taxas_org_vencimento_tpi; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE INDEX ix_taxas_org_vencimento_tpi ON public.taxas USING btree (org_id, vencimento_tpi);


--
-- Name: uq_empresas_org_cnpj; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_empresas_org_cnpj ON public.empresas USING btree (org_id, cnpj);


--
-- Name: uq_licencas_org_empresa_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_licencas_org_empresa_tipo ON public.licencas USING btree (org_id, empresa_id, tipo);


--
-- Name: uq_orgs_name; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_orgs_name ON public.orgs USING btree (name);


--
-- Name: uq_proc_avulso_doc_tipo_data_null_protocolo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_avulso_doc_tipo_data_null_protocolo ON public.processos_avulsos USING btree (documento, tipo, data_solicitacao) WHERE (protocolo IS NULL);


--
-- Name: uq_proc_avulso_doc_tipo_null_protocolo_null_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_avulso_doc_tipo_null_protocolo_null_data ON public.processos_avulsos USING btree (documento, tipo) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NULL));


--
-- Name: uq_proc_avulso_org_doc_tipo_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_avulso_org_doc_tipo_data ON public.processos_avulsos USING btree (org_id, documento, tipo, data_solicitacao) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NOT NULL));


--
-- Name: uq_proc_avulso_org_doc_tipo_sem_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_avulso_org_doc_tipo_sem_data ON public.processos_avulsos USING btree (org_id, documento, tipo) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NULL));


--
-- Name: uq_proc_avulso_org_protocolo_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_avulso_org_protocolo_tipo ON public.processos_avulsos USING btree (org_id, protocolo, tipo) WHERE (protocolo IS NOT NULL);


--
-- Name: uq_proc_empresa_tipo_com_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_empresa_tipo_com_data ON public.processos USING btree (empresa_id, tipo, data_solicitacao) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NOT NULL));


--
-- Name: uq_proc_empresa_tipo_sem_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_empresa_tipo_sem_data ON public.processos USING btree (empresa_id, tipo) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NULL));


--
-- Name: uq_proc_org_empresa_tipo_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_org_empresa_tipo_data ON public.processos USING btree (org_id, empresa_id, tipo, data_solicitacao) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NOT NULL));


--
-- Name: uq_proc_org_empresa_tipo_sem_data; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_org_empresa_tipo_sem_data ON public.processos USING btree (org_id, empresa_id, tipo) WHERE ((protocolo IS NULL) AND (data_solicitacao IS NULL));


--
-- Name: uq_proc_org_protocolo_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_org_protocolo_tipo ON public.processos USING btree (org_id, protocolo, tipo) WHERE (protocolo IS NOT NULL);


--
-- Name: uq_proc_protocolo_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_proc_protocolo_tipo ON public.processos USING btree (protocolo, tipo) WHERE (protocolo IS NOT NULL);


--
-- Name: uq_taxas_org_empresa_tipo; Type: INDEX; Schema: public; Owner: econtrole
--

CREATE UNIQUE INDEX uq_taxas_org_empresa_tipo ON public.taxas USING btree (org_id, empresa_id, tipo);


--
-- Name: agendamentos agendamentos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: certificados certificados_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.certificados
    ADD CONSTRAINT certificados_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);


--
-- Name: empresas fk_empresas_created_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT fk_empresas_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: empresas fk_empresas_org; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT fk_empresas_org FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: empresas fk_empresas_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT fk_empresas_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: licencas fk_licencas_created_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas
    ADD CONSTRAINT fk_licencas_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: licencas fk_licencas_org; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas
    ADD CONSTRAINT fk_licencas_org FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: licencas fk_licencas_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas
    ADD CONSTRAINT fk_licencas_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: processos_avulsos fk_processos_avulsos_org; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos_avulsos
    ADD CONSTRAINT fk_processos_avulsos_org FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: processos fk_processos_created_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT fk_processos_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: processos fk_processos_org; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT fk_processos_org FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: processos fk_processos_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT fk_processos_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: taxas fk_taxas_created_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas
    ADD CONSTRAINT fk_taxas_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: taxas fk_taxas_org; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas
    ADD CONSTRAINT fk_taxas_org FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- Name: taxas fk_taxas_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas
    ADD CONSTRAINT fk_taxas_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: licencas licencas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.licencas
    ADD CONSTRAINT licencas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: processos processos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT processos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: taxas taxas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.taxas
    ADD CONSTRAINT taxas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: econtrole
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict qg7Hd0Z1qaI4uy1R72eeZUd0gTCftiErUE4Zf2d4z0fE4iQpCtLoo6mHbKufNQt
