/**
 * Jest e2e setup (runs before any e2e spec is loaded).
 *
 * Goal: keep e2e tests self-contained by disabling RabbitMQ consumers/publishing.
 */
// Force-disable (even if .env has it enabled)
process.env.RABBITMQ_CONSUMER_ENABLED = 'false';

// EmployeesService only publishes when this is non-empty.
process.env.RABBITMQ_EMPLOYEE_EVENTS_QUEUE_OR_ROUTINGKEY = '';

