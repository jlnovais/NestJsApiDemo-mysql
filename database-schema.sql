-- MySQL Database Schema for Employee Table
-- Run this SQL script to create the Employee table

CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

CREATE TABLE IF NOT EXISTS Employee (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('INTERN', 'ENGINEER', 'ADMIN') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stored Procedure for paginated employee listing with search and sorting
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS `Employees_List`(
    IN Page INT,
    IN PageSize INT,
    IN Role VARCHAR(20),
    IN SearchName VARCHAR(255),
    IN SearchEmail VARCHAR(255),
    IN SortBy VARCHAR(50),
    IN SortOrder VARCHAR(10)
)
BEGIN
    IF (Page <= 0) THEN
        SET @_page = 1;
    ELSE
        SET @_page = Page;
    END IF;

    SET @recordsOffset = (@_page - 1) * PageSize;
    
    SET @sqlMain = '';
    
    -- Add role filter
    IF Role IS NOT NULL AND NOT Role = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND role = ''', Role, '''');
    END IF;
    
    -- Add name search filter
    IF SearchName IS NOT NULL AND NOT SearchName = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND name LIKE ''%', REPLACE(SearchName, '''', ''''''), '%''');
    END IF;
    
    -- Add email search filter
    IF SearchEmail IS NOT NULL AND NOT SearchEmail = '' THEN
        SET @sqlMain = CONCAT(@sqlMain, ' AND email LIKE ''%', REPLACE(SearchEmail, '''', ''''''), '%''');
    END IF;
    
    -- Set default sort column and order
    IF SortBy IS NULL OR SortBy = '' THEN
        SET @sortColumn = 'id';
    ELSEIF SortBy = 'createdAt' OR SortBy = 'name' THEN
        SET @sortColumn = SortBy;
    ELSE
        SET @sortColumn = 'id';
    END IF;
    
    IF SortOrder IS NULL OR SortOrder = '' THEN
        SET @sortDirection = 'ASC';
    ELSEIF UPPER(SortOrder) = 'DESC' THEN
        SET @sortDirection = 'DESC';
    ELSE
        SET @sortDirection = 'ASC';
    END IF;

    SET @sqlTxt = CONCAT('
        WITH _data AS (
            SELECT * FROM Employee WHERE 1=1 
        ', @sqlMain, '
        ),
        _count AS (
            SELECT COUNT(*) AS TotalCount FROM _data
        )
        SELECT * FROM _data, _count 
        ORDER BY ', @sortColumn, ' ', @sortDirection, '
        LIMIT ', PageSize, ' OFFSET ', @recordsOffset, ';');
     
    PREPARE execQuery FROM @sqlTxt;
    EXECUTE execQuery;
    DEALLOCATE PREPARE execQuery;
END$$

DELIMITER ;

