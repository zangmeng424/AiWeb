-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- 主机： localhost
-- 生成日期： 2025-10-27 14:45:32
-- 服务器版本： 8.0.36
-- PHP 版本： 8.0.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `aiweb`
--

-- --------------------------------------------------------

--
-- 表的结构 `chat_history`
--

CREATE TABLE `chat_history` (
  `id` int NOT NULL,
  `session_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `chat_uuid` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('user','assistant','tool') COLLATE utf8mb4_general_ci NOT NULL,
  `content` text COLLATE utf8mb4_general_ci,
  `children` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `metadata` text COLLATE utf8mb4_general_ci,
  `created_at` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- 表的结构 `chat_menu`
--

CREATE TABLE `chat_menu` (
  `id` int NOT NULL,
  `session_id` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '新对话',
  `system` text COLLATE utf8mb4_general_ci,
  `avatar` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `max_take` int DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `top_p` float DEFAULT NULL,
  `status` varchar(10) COLLATE utf8mb4_general_ci DEFAULT '1',
  `create_at` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `lastuse_at` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- 表的结构 `model_menu`
--

CREATE TABLE `model_menu` (
  `id` int NOT NULL,
  `model_uuid` varchar(36) COLLATE utf8mb4_general_ci NOT NULL,
  `model_name` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `system` text COLLATE utf8mb4_general_ci,
  `max_take` int DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `top_p` float DEFAULT NULL,
  `base_url` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `api_key` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_default` tinyint DEFAULT '0',
  `create_at` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- 转存表中的数据 `model_menu`
--

INSERT INTO `model_menu` (`id`, `model_uuid`, `model_name`, `model`, `system`, `max_take`, `temperature`, `top_p`, `base_url`, `api_key`, `is_default`, `create_at`) VALUES
(1, '9f5427af-ebae-44e4-b9da-d6d93449b9c5', 'deepseek', 'deepseek-chat', '简洁回答', 20, 0, 1, 'https://api.deepseek.com', 'sk-XXXXXX', 1, '1761546155');

--
-- 转储表的索引
--

--
-- 表的索引 `chat_history`
--
ALTER TABLE `chat_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_history_session_id` (`session_id`),
  ADD KEY `idx_chat_history_chat_uuid` (`chat_uuid`),
  ADD KEY `idx_chat_history_created_at` (`created_at`);

--
-- 表的索引 `chat_menu`
--
ALTER TABLE `chat_menu`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_id` (`session_id`),
  ADD KEY `idx_chat_menu_status` (`status`),
  ADD KEY `idx_chat_menu_create_at` (`create_at`);

--
-- 表的索引 `model_menu`
--
ALTER TABLE `model_menu`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `model_uuid` (`model_uuid`),
  ADD KEY `idx_model_menu_is_default` (`is_default`);

--
-- 在导出的表使用AUTO_INCREMENT
--

--
-- 使用表AUTO_INCREMENT `chat_history`
--
ALTER TABLE `chat_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- 使用表AUTO_INCREMENT `chat_menu`
--
ALTER TABLE `chat_menu`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- 使用表AUTO_INCREMENT `model_menu`
--
ALTER TABLE `model_menu`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
