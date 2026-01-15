-- Migration: Add photoUrl column to Employee table
-- Run this SQL script to add photo storage support

USE testdb;

ALTER TABLE Employee 
ADD COLUMN photoUrl VARCHAR(2048) NULL AFTER role;

-- Add index for photoUrl if needed (optional)
-- CREATE INDEX idx_photoUrl ON Employee(photoUrl);
