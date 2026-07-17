--
-- PostgreSQL database dump
--

\restrict 9DpbC2fSOjS9ubUkWFzJOFgLNUh6XYJPFv4ewtczRJ5gvPb6XQwemEIHZngOB7z

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
71bbe139-a35d-494b-b6a0-bddfbc8bc73a	71bbe139-a35d-494b-b6a0-bddfbc8bc73a	{"sub": "71bbe139-a35d-494b-b6a0-bddfbc8bc73a", "email": "student@platform.com", "email_verified": false, "phone_verified": false}	email	2026-06-25 20:54:40.948473+00	2026-06-25 20:54:40.948519+00	2026-06-25 20:54:40.948519+00	58792abc-1b84-4726-8fe3-54dccf3fb7db
80aeee02-e678-40f6-ace8-20a9a0b575cd	80aeee02-e678-40f6-ace8-20a9a0b575cd	{"sub": "80aeee02-e678-40f6-ace8-20a9a0b575cd", "email": "proahmedashraf0@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-07 13:00:01.047179+00	2026-07-07 13:00:01.047245+00	2026-07-07 13:00:01.047245+00	5a6d896d-8e87-41f2-a9c7-181f89dd9ea0
5fe3265d-a754-42bb-834d-bd11969078d9	5fe3265d-a754-42bb-834d-bd11969078d9	{"sub": "5fe3265d-a754-42bb-834d-bd11969078d9", "email": "test-1783493236@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:47:16.954454+00	2026-07-08 06:47:16.954511+00	2026-07-08 06:47:16.954511+00	af04097f-2c3c-4cbe-af23-6bc968e8317a
7781f763-4944-457a-972f-50c57d7eda76	7781f763-4944-457a-972f-50c57d7eda76	{"sub": "7781f763-4944-457a-972f-50c57d7eda76", "email": "mr019722@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-06-26 07:02:18.964931+00	2026-06-26 07:02:18.964981+00	2026-06-26 07:02:18.964981+00	2eaababc-d689-4cd2-b82f-c1b7fb5aeb9f
79e42b41-dcf0-477b-9b19-2772b89a58ec	79e42b41-dcf0-477b-9b19-2772b89a58ec	{"sub": "79e42b41-dcf0-477b-9b19-2772b89a58ec", "email": "mr01972222@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-06-26 07:43:12.224914+00	2026-06-26 07:43:12.224967+00	2026-06-26 07:43:12.224967+00	3aa95984-117c-4d9f-88c6-83bdd253a00f
9d9c8b71-b81e-4422-853a-8f2c9a7fef68	9d9c8b71-b81e-4422-853a-8f2c9a7fef68	{"sub": "9d9c8b71-b81e-4422-853a-8f2c9a7fef68", "email": "mr0197222@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-06-27 01:57:52.255101+00	2026-06-27 01:57:52.255159+00	2026-06-27 01:57:52.255159+00	61869786-8b58-45e9-a43e-7601f393d911
8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	{"sub": "8b17aac9-e7bb-4e84-a09b-e026ce4a8b55", "email": "sayedxiv@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-06-27 02:00:35.396141+00	2026-06-27 02:00:35.396206+00	2026-06-27 02:00:35.396206+00	b690a0ca-a2bb-4b95-8ba7-7dfcb9550705
6acccd5b-69ee-439e-86ab-dad4936ff251	6acccd5b-69ee-439e-86ab-dad4936ff251	{"sub": "6acccd5b-69ee-439e-86ab-dad4936ff251", "email": "admin@test.com", "email_verified": false, "phone_verified": false}	email	2026-06-25 20:54:40.809983+00	2026-06-25 20:54:40.810051+00	2026-06-25 20:54:40.810051+00	811e0e1c-bea6-4e59-889a-c872fbfe4f9c
62c739a6-1a9b-40f4-9faf-77be78ef8431	62c739a6-1a9b-40f4-9faf-77be78ef8431	{"sub": "62c739a6-1a9b-40f4-9faf-77be78ef8431", "email": "mashwi@test.com", "email_verified": false, "phone_verified": false}	email	2026-07-02 02:54:53.226307+00	2026-07-02 02:54:53.226405+00	2026-07-02 02:54:53.226405+00	66ca5fda-7b0e-4018-b888-6ffa2cdb897f
83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	{"sub": "83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f", "email": "mr019722222@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-05 20:04:41.717032+00	2026-07-05 20:04:41.717091+00	2026-07-05 20:04:41.717091+00	bd33ad43-0206-4a9b-8054-b4a64d6be720
ce9addea-1f3d-4d98-91c2-0edd726365e4	ce9addea-1f3d-4d98-91c2-0edd726365e4	{"sub": "ce9addea-1f3d-4d98-91c2-0edd726365e4", "email": "sdktest-1783493277439@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:47:57.559172+00	2026-07-08 06:47:57.559223+00	2026-07-08 06:47:57.559223+00	0a5f9f70-c0e4-4dca-a0d0-605b19f0020d
0e75d9a3-ae1d-43cc-a75a-61c376542493	0e75d9a3-ae1d-43cc-a75a-61c376542493	{"sub": "0e75d9a3-ae1d-43cc-a75a-61c376542493", "email": "flk-def0-1783493329739@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:49.872724+00	2026-07-08 06:48:49.872771+00	2026-07-08 06:48:49.872771+00	b170daf2-747a-4f8d-9e83-f7d97d54b8d3
89aa424f-2b05-4cbc-987c-c0a26e85a21c	89aa424f-2b05-4cbc-987c-c0a26e85a21c	{"sub": "89aa424f-2b05-4cbc-987c-c0a26e85a21c", "email": "flk-def1-1783493329947@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:50.037655+00	2026-07-08 06:48:50.037702+00	2026-07-08 06:48:50.037702+00	bd47815d-cf95-4bb2-b3ae-32d55b0a4aa7
bf49ef9a-9c41-4c5f-8159-09a73bcaf1f3	bf49ef9a-9c41-4c5f-8159-09a73bcaf1f3	{"sub": "bf49ef9a-9c41-4c5f-8159-09a73bcaf1f3", "email": "flk-def2-1783493330102@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:50.192041+00	2026-07-08 06:48:50.192091+00	2026-07-08 06:48:50.192091+00	635f57be-17a5-4212-b2f6-0f83a7aa4cbe
5f0cd85c-b0fa-4380-b2ad-f661992be965	5f0cd85c-b0fa-4380-b2ad-f661992be965	{"sub": "5f0cd85c-b0fa-4380-b2ad-f661992be965", "email": "flk-wrp0-1783493330257@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:50.345613+00	2026-07-08 06:48:50.345663+00	2026-07-08 06:48:50.345663+00	d2c12d6e-e3ec-4f69-ac68-ab0d3a4810c0
dd561d77-9b4f-49ed-addf-5c3213e2551a	dd561d77-9b4f-49ed-addf-5c3213e2551a	{"sub": "dd561d77-9b4f-49ed-addf-5c3213e2551a", "email": "flk-wrp1-1783493330411@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:50.500072+00	2026-07-08 06:48:50.500124+00	2026-07-08 06:48:50.500124+00	c6dcb82d-9cff-4c1e-9cc1-515397350b35
5635d05b-2963-4e59-9240-12beb45528dc	5635d05b-2963-4e59-9240-12beb45528dc	{"sub": "5635d05b-2963-4e59-9240-12beb45528dc", "email": "flk-wrp2-1783493330565@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 06:48:50.654099+00	2026-07-08 06:48:50.654151+00	2026-07-08 06:48:50.654151+00	3d9bf9dc-1ae8-4cb7-9219-36bf0d7a20af
f1f8849a-ee21-4dc8-a807-ad2bea1704bd	f1f8849a-ee21-4dc8-a807-ad2bea1704bd	{"sub": "f1f8849a-ee21-4dc8-a807-ad2bea1704bd", "email": "test_assistant_err4@example.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 07:04:22.349102+00	2026-07-08 07:04:22.349208+00	2026-07-08 07:04:22.349208+00	8d30f239-8619-4bce-8708-35c69e6d9452
eebff5bc-2e84-42a9-85e4-e305c519ecfa	eebff5bc-2e84-42a9-85e4-e305c519ecfa	{"sub": "eebff5bc-2e84-42a9-85e4-e305c519ecfa", "email": "sayed.s.elshazly@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 07:18:49.743546+00	2026-07-08 07:18:49.743635+00	2026-07-08 07:18:49.743635+00	62e0917b-260f-4e00-985c-7bded41138bd
4a5158cf-7d80-4c83-9ec6-df3c82e2419c	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	{"sub": "4a5158cf-7d80-4c83-9ec6-df3c82e2419c", "email": "mr01972e52d322@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-08 09:22:04.27363+00	2026-07-08 09:22:04.273694+00	2026-07-08 09:22:04.273694+00	02e8db1d-a801-43b3-8632-966a29aa3f6b
abbf0a7b-fcb9-41df-800c-b796c7fbe37f	abbf0a7b-fcb9-41df-800c-b796c7fbe37f	{"sub": "abbf0a7b-fcb9-41df-800c-b796c7fbe37f", "email": "mr01972222222@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-13 15:22:00.840057+00	2026-07-13 15:22:00.84067+00	2026-07-13 15:22:00.84067+00	2b2bc7e8-1d6a-47cc-8f65-2da941d082ac
9da04a2b-558b-48ba-a8c4-efcf7c5a850e	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	{"sub": "9da04a2b-558b-48ba-a8c4-efcf7c5a850e", "email": "mr0192@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-13 19:10:48.887365+00	2026-07-13 19:10:48.887432+00	2026-07-13 19:10:48.887432+00	877413b7-1700-40ca-a6f8-f4368e5dad93
3f20448a-10da-4ad9-84bc-9a1a5ed247ca	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	{"sub": "3f20448a-10da-4ad9-84bc-9a1a5ed247ca", "email": "mr019711222@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-07-13 19:50:56.595085+00	2026-07-13 19:50:56.595723+00	2026-07-13 19:50:56.595723+00	950dd966-b6b2-4fa8-924d-45b34ca371bf
\.


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 9DpbC2fSOjS9ubUkWFzJOFgLNUh6XYJPFv4ewtczRJ5gvPb6XQwemEIHZngOB7z

