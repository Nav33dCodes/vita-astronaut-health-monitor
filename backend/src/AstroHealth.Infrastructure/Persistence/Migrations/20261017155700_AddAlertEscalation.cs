using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AstroHealth.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAlertEscalation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EscalatedAtUtc",
                table: "HealthAlerts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EscalationLevel",
                table: "HealthAlerts",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EscalatedAtUtc",
                table: "HealthAlerts");

            migrationBuilder.DropColumn(
                name: "EscalationLevel",
                table: "HealthAlerts");
        }
    }
}
