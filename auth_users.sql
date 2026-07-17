--
-- PostgreSQL database dump
--

\restrict EZscWxHolinlO1CuPtw8vnlHAJqJFLNZKc9b8vMJzok6RjawgwuAb0a4C8KXsaR

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
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	5f0cd85c-b0fa-4380-b2ad-f661992be965	authenticated	authenticated	flk-wrp0-1783493330257@example.com	$2a$10$FmYMZ40zRew3rb.Tn929LOTD4hc0RIg9kBRM0eLgaITJaw6WVx5HC	2026-07-08 06:48:50.347101+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:50.343475+00	2026-07-08 06:48:50.347863+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	71bbe139-a35d-494b-b6a0-bddfbc8bc73a	authenticated	authenticated	student@platform.com	$2a$06$d6JzSzO2rNUcrOAehjEx8.sYCC13b5IH/yABOPctV6NkkEhZAShn2	2026-06-25 20:54:40.949868+00	\N		\N		\N			\N	2026-07-02 03:17:27.654177+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-3", "full_name": "محمد إبراهيم", "email_verified": true}	\N	2026-06-25 20:54:40.946991+00	2026-07-02 03:17:27.663+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	79e42b41-dcf0-477b-9b19-2772b89a58ec	authenticated	authenticated	mr01972222@gmail.com	$2a$10$XMXLAb/C/bUed/LZofsuEuUo.DdSQvPOO6z3ctPSAqqMK3Ts8qdc.	2026-06-26 07:44:20.22304+00	\N		\N		\N			\N	2026-06-27 02:25:50.810433+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-3", "phone": "+201009771898", "full_name": "عمار", "email_verified": true}	\N	2026-06-26 07:43:12.158596+00	2026-06-29 07:36:25.419058+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	abbf0a7b-fcb9-41df-800c-b796c7fbe37f	authenticated	authenticated	mr01972222222@gmail.com	$2a$10$3E.1qY88yKDt84SeVScw2eoSKHTZCGu2k5Lelr4D.UVNwtpzVWEna	2026-07-13 15:22:00.854848+00	\N		\N		\N			\N	2026-07-13 15:22:01.633579+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-2", "phone": "01009001898", "full_name": "عمار ابرايهم", "email_verified": true}	\N	2026-07-13 15:22:00.763101+00	2026-07-13 15:22:01.670905+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	7781f763-4944-457a-972f-50c57d7eda76	authenticated	authenticated	mr019722@gmail.com	$2a$10$tuOAhhyP2Q3tMlS0QgPIy.NP8YIM4QjxPPjcJjcixQthmTR.osvsW	\N	\N	afe96019541cc07a2d42c6dc94433cf8fb411eb9d20fee22873b1b64	2026-06-26 07:02:18.818709+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-1", "phone": "01009771333", "full_name": "عمار ابراهيم"}	\N	2026-06-26 07:02:18.900625+00	2026-06-26 07:02:18.97057+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	8b17aac9-e7bb-4e84-a09b-e026ce4a8b55	authenticated	authenticated	sayedxiv@gmail.com	$2a$10$Ck9tLmy4Qqjz/Ddwtu2vIue53tlnUoa.C/5.Cm120cu7Wjg1sh.0S	2026-06-27 02:01:26.102794+00	\N		2026-06-27 02:00:35.291378+00		\N			\N	2026-07-12 16:22:05.424407+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-1", "phone": "01020962775", "full_name": "sayed", "email_verified": true}	\N	2026-06-27 02:00:35.374847+00	2026-07-12 16:22:05.445946+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	83eaa8dc-c843-4edd-b1f6-6aeb6a0aa71f	authenticated	authenticated	mr019722222@gmail.com	$2a$10$at9ZLnwhGbsCf3xfaZpr7.m8TWKgg/jJu8OUTI5Ux0kkDbIgy1bya	2026-07-05 20:04:41.723728+00	\N		\N		\N			\N	2026-07-13 15:53:05.960473+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-2", "phone": "01116013151", "full_name": "عمار ابراهيم", "email_verified": true}	\N	2026-07-05 20:04:41.69168+00	2026-07-13 18:14:50.984763+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	80aeee02-e678-40f6-ace8-20a9a0b575cd	authenticated	authenticated	proahmedashraf0@gmail.com	$2a$10$hylheV..ISuHktLWjjXXNeLQuPdDjM0fNga9hwzQjRA/csDMQQeXG	2026-07-07 13:00:01.060065+00	\N		\N		\N			\N	2026-07-07 13:00:02.253537+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-3", "phone": "+201021257615", "full_name": "ahmed ashraf", "email_verified": true}	\N	2026-07-07 13:00:00.982993+00	2026-07-07 13:00:02.308359+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	3f20448a-10da-4ad9-84bc-9a1a5ed247ca	authenticated	authenticated	mr019711222@gmail.com	$2a$10$Zr0obJMB7dt/WBz5S/fWtuzlmMWtlW.rfnr2pBx1ZR5y0tAelUani	2026-07-13 19:50:56.612365+00	\N		\N		\N			\N	2026-07-13 20:05:08.191485+00	{"provider": "email", "providers": ["email"]}	{"role": "assistant", "full_name": "عمار", "email_verified": true}	\N	2026-07-13 19:50:56.427032+00	2026-07-13 20:05:08.294649+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	62c739a6-1a9b-40f4-9faf-77be78ef8431	authenticated	authenticated	mashwi@test.com	$2a$10$yCUItarJJk3OtoGb1pQon.SljGfS.MEuHkF0RKEgpwuMjpxWLf7Qq	2026-07-02 02:54:53.234209+00	\N		\N		\N			\N	2026-07-02 02:54:53.739077+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-2", "phone": "010101010", "full_name": "البتنجان المشوي", "email_verified": true}	\N	2026-07-02 02:54:53.168919+00	2026-07-02 02:54:53.77131+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5fe3265d-a754-42bb-834d-bd11969078d9	authenticated	authenticated	test-1783493236@example.com	$2a$10$dkNXc1QODwJb3H2vNqtVOeK6YtKF0ZdAoLNYNonYuvMU/JP1Q.0YW	2026-07-08 06:47:16.96324+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:47:16.93046+00	2026-07-08 06:47:16.964243+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9d9c8b71-b81e-4422-853a-8f2c9a7fef68	authenticated	authenticated	mr0197222@gmail.com	$2a$10$CJm6hxAyH9un2t2I3N9.WukYZsDcSK6jzoLppRcHfl3JzGNT4H25W	\N	\N	9b33eba23e468a5ce31583fb150c32be481065b130900129b0566921	2026-06-27 01:57:52.08919+00		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-1", "phone": "+201009781898", "full_name": "عمار"}	\N	2026-06-27 01:57:52.174902+00	2026-06-27 01:57:52.264497+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0e75d9a3-ae1d-43cc-a75a-61c376542493	authenticated	authenticated	flk-def0-1783493329739@example.com	$2a$10$hxNnjDpZKSEeKvdLJhJfVezEwUAMIbzSf5UAvBysVRZk7uNspwv86	2026-07-08 06:48:49.874235+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:49.870997+00	2026-07-08 06:48:49.876434+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ce9addea-1f3d-4d98-91c2-0edd726365e4	authenticated	authenticated	sdktest-1783493277439@example.com	$2a$10$YmaVVPOvolBcJTOiSq1IaeG0kl9N5/ZJfzUs.uJy439nWxamIFLwi	2026-07-08 06:47:57.560654+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:47:57.557742+00	2026-07-08 06:47:57.561429+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	bf49ef9a-9c41-4c5f-8159-09a73bcaf1f3	authenticated	authenticated	flk-def2-1783493330102@example.com	$2a$10$AHj26s0Eb0RjtJ.YfqJNruOiKUKD6zoXT9HbhPqETbq8YKnk6t7Fe	2026-07-08 06:48:50.193498+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:50.190437+00	2026-07-08 06:48:50.19426+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	89aa424f-2b05-4cbc-987c-c0a26e85a21c	authenticated	authenticated	flk-def1-1783493329947@example.com	$2a$10$mcHIJqyXfDbuV3CzBdKQaO5pYgCCsv6cANuoD1a/bzqBcEffqesve	2026-07-08 06:48:50.039026+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:50.035586+00	2026-07-08 06:48:50.039783+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	dd561d77-9b4f-49ed-addf-5c3213e2551a	authenticated	authenticated	flk-wrp1-1783493330411@example.com	$2a$10$k/1pwr0UqKVwnoVIZa728.wEP.KQbvM4npOe64IcBFcMVvWji2Pjq	2026-07-08 06:48:50.501846+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:50.498822+00	2026-07-08 06:48:50.502551+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5635d05b-2963-4e59-9240-12beb45528dc	authenticated	authenticated	flk-wrp2-1783493330565@example.com	$2a$10$RTyGZNi.tOHmXM370Lz1x.b0QKvQGQLe87nnLmy4EZtI9B7i7XWnS	2026-07-08 06:48:50.655362+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-07-08 06:48:50.652128+00	2026-07-08 06:48:50.656029+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	f1f8849a-ee21-4dc8-a807-ad2bea1704bd	authenticated	authenticated	test_assistant_err4@example.com	$2a$10$JiFEW8lR6AQdYv.ZtvbpTOREdpFxjxBz4AsJRkJ1odzbS1WgU7IDO	2026-07-08 07:04:22.362042+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "assistant", "email_verified": true}	\N	2026-07-08 07:04:22.308785+00	2026-07-08 07:04:22.363246+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	eebff5bc-2e84-42a9-85e4-e305c519ecfa	authenticated	authenticated	sayed.s.elshazly@gmail.com	$2a$10$J/o0md6XTAuUVXyiG79NUuUEg1B8EgEsMLyf2JGL0OACPrf9B/.m6	2026-07-08 07:18:49.752229+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "assistant", "full_name": "سيد", "email_verified": true}	\N	2026-07-08 07:18:49.702302+00	2026-07-08 07:18:49.754775+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	4a5158cf-7d80-4c83-9ec6-df3c82e2419c	authenticated	authenticated	mr01972e52d322@gmail.com	$2a$10$QAjLuzih10RvB25Oa6gGIe/Kck4FuWMbuVo8kdP8.p0DO1t8YPstG	2026-07-08 09:22:04.280801+00	\N		\N		\N			\N	2026-07-08 09:22:17.131449+00	{"provider": "email", "providers": ["email"]}	{"role": "assistant", "full_name": "عمار", "email_verified": true}	\N	2026-07-08 09:22:04.228002+00	2026-07-08 09:22:17.176988+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9da04a2b-558b-48ba-a8c4-efcf7c5a850e	authenticated	authenticated	mr0192@gmail.com	$2a$10$3/nxLkrqwMqWmwqMWTFexunnm.SWjlw4P2XfUXUJV1ONETWAzxsb2	2026-07-13 19:10:48.892543+00	\N		\N		\N			\N	2026-07-15 23:18:12.564925+00	{"provider": "email", "providers": ["email"]}	{"role": "student", "grade": "sec-1", "phone": "01122556530", "full_name": "عمار ابراهيم", "email_verified": true}	\N	2026-07-13 19:10:48.854869+00	2026-07-16 20:01:45.772136+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6acccd5b-69ee-439e-86ab-dad4936ff251	authenticated	authenticated	admin@test.com	$2a$06$RPJM9fVOrUrX3ZLXEKxoPO/vVKW0N0N48a0fZNVyMQZWlW5/rsA4a	2026-06-25 20:54:40.816013+00	\N		\N		\N			\N	2026-07-15 21:20:12.636209+00	{"provider": "email", "providers": ["email"]}	{"role": "admin", "full_name": "محمد أحمد", "email_verified": true}	\N	2026-06-25 20:54:40.782473+00	2026-07-16 21:47:52.467453+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict EZscWxHolinlO1CuPtw8vnlHAJqJFLNZKc9b8vMJzok6RjawgwuAb0a4C8KXsaR

