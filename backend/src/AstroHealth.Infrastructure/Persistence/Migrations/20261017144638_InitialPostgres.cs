using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AstroHealth.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Missions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Destination = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    LaunchDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Missions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Astronauts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    LastName = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Agency = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: false),
                    MissionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Astronauts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Astronauts_Missions_MissionId",
                        column: x => x.MissionId,
                        principalTable: "Missions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VitalReadings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AstronautId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    HeartRateBpm = table.Column<int>(type: "integer", nullable: false),
                    SystolicMmHg = table.Column<int>(type: "integer", nullable: false),
                    DiastolicMmHg = table.Column<int>(type: "integer", nullable: false),
                    OxygenSaturationPct = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    BodyTemperatureC = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    RespiratoryRatePerMin = table.Column<int>(type: "integer", nullable: false),
                    RadiationDoseMsv = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VitalReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VitalReadings_Astronauts_AstronautId",
                        column: x => x.AstronautId,
                        principalTable: "Astronauts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VitalRollups",
                columns: table => new
                {
                    AstronautId = table.Column<Guid>(type: "uuid", nullable: false),
                    BucketStartUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Samples = table.Column<int>(type: "integer", nullable: false),
                    AvgHeartRateBpm = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    MinHeartRateBpm = table.Column<int>(type: "integer", nullable: false),
                    MaxHeartRateBpm = table.Column<int>(type: "integer", nullable: false),
                    AvgSystolicMmHg = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    AvgDiastolicMmHg = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    AvgOxygenSaturationPct = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    MinOxygenSaturationPct = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    AvgBodyTemperatureC = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    MaxBodyTemperatureC = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    AvgRespiratoryRatePerMin = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: false),
                    AvgRadiationDoseMsv = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    TotalRadiationDoseMsv = table.Column<decimal>(type: "numeric(12,4)", precision: 12, scale: 4, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VitalRollups", x => new { x.AstronautId, x.BucketStartUtc });
                    table.ForeignKey(
                        name: "FK_VitalRollups_Astronauts_AstronautId",
                        column: x => x.AstronautId,
                        principalTable: "Astronauts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HealthAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AstronautId = table.Column<Guid>(type: "uuid", nullable: false),
                    VitalReadingId = table.Column<Guid>(type: "uuid", nullable: true),
                    Metric = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Severity = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ObservedValue = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    Message = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RaisedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcknowledgedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ResolvedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ResolutionNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HealthAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HealthAlerts_Astronauts_AstronautId",
                        column: x => x.AstronautId,
                        principalTable: "Astronauts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HealthAlerts_VitalReadings_VitalReadingId",
                        column: x => x.VitalReadingId,
                        principalTable: "VitalReadings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Astronauts_LastName_FirstName",
                table: "Astronauts",
                columns: new[] { "LastName", "FirstName" });

            migrationBuilder.CreateIndex(
                name: "IX_Astronauts_MissionId",
                table: "Astronauts",
                column: "MissionId");

            migrationBuilder.CreateIndex(
                name: "IX_HealthAlerts_AstronautId_Status",
                table: "HealthAlerts",
                columns: new[] { "AstronautId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_HealthAlerts_Status_Severity",
                table: "HealthAlerts",
                columns: new[] { "Status", "Severity" });

            migrationBuilder.CreateIndex(
                name: "IX_HealthAlerts_VitalReadingId",
                table: "HealthAlerts",
                column: "VitalReadingId");

            migrationBuilder.CreateIndex(
                name: "IX_Missions_Name",
                table: "Missions",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Missions_Status",
                table: "Missions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_VitalReadings_AstronautId_RecordedAtUtc",
                table: "VitalReadings",
                columns: new[] { "AstronautId", "RecordedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_VitalReadings_RecordedAtUtc",
                table: "VitalReadings",
                column: "RecordedAtUtc")
                .Annotation("Npgsql:IndexMethod", "brin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "HealthAlerts");

            migrationBuilder.DropTable(
                name: "VitalRollups");

            migrationBuilder.DropTable(
                name: "VitalReadings");

            migrationBuilder.DropTable(
                name: "Astronauts");

            migrationBuilder.DropTable(
                name: "Missions");
        }
    }
}
