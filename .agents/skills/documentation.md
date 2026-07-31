# Project Analysis Scope

## 1. Project Architecture

### 1.1 Overall Folder Structure

* Complete directory hierarchy
* Purpose of each folder
* Module organization
* Resource organization

### 1.2 Technology Stack

* Programming language(s)
* Framework(s)
* Database
* Frontend technologies
* Third-party libraries
* Build tools
* Deployment environment

### 1.3 Design Patterns

* Architectural pattern (MVC, HMVC, etc.)
* Repository pattern
* Service layer
* Dependency Injection
* Factory/Strategy/Observer patterns (if applicable)

### 1.4 Code Organization

* Module structure
* Naming conventions
* Coding standards
* Reusability
* Separation of concerns

### 1.5 Dependency Graph

* Internal module dependencies
* External package dependencies
* Database dependencies
* API integrations
* Third-party services

---

# 2. Backend Analysis

## 2.1 Authentication & Authorization

* Login flow
* Session management
* Password hashing
* Role-based access control (RBAC)
* Permission management
* Security implementation

## 2.2 Database Schema

* Entity Relationship Diagram (ERD)
* Tables
* Relationships
* Primary & Foreign Keys
* Constraints
* Indexes

## 2.3 Models

* Business entities
* Relationships
* Data handling
* Validation rules

## 2.4 Controllers

* Responsibilities
* Request handling
* Business logic
* Response structure

## 2.5 APIs

* Available endpoints
* Request/response format
* Authentication mechanism
* API versioning
* Error handling

## 2.6 Middleware

* Authentication middleware
* Authorization middleware
* Logging
* Request validation
* Security middleware

## 2.7 Validation

* Server-side validation
* Input sanitization
* Custom validation rules
* Error messages

## 2.8 Security

* Authentication security
* Authorization security
* SQL Injection prevention
* XSS protection
* CSRF protection
* File upload security
* Session security
* Password security
* Sensitive data handling

## 2.9 Performance Analysis

* Database query optimization
* N+1 query detection
* Caching opportunities
* Slow execution paths
* Resource utilization
* Scalability considerations

---

# 3. Data Dictionary

A complete data dictionary for the project database including:

For each table:

* Table Name
* Purpose
* Primary Key
* Foreign Keys
* Relationships
* Indexes

For each column:

| Field Name | Data Type | Length | Nullable | Default | Key | Description |
| ---------- | --------- | ------ | -------- | ------- | --- | ----------- |

Additionally:

* Entity Relationship Diagram (ERD)
* Table relationships
* Data flow between entities
* Master tables
* Transaction tables
* Audit tables
* Lookup tables
* Suggested improvements and normalization review
