export interface DailyPoint {
    date: string
    total: number
    passed: number
    failed: number
    rate: number
}

export interface TopModule {
    test_id: string
    count: number
    failures: number
}

export interface RecentRun {
    run_id: string
    source: string
    ip_address: string
    status: string
    test_count: number
    passed: number
    failed: number
    started_at: string
    completed_at: string
    branch: string
    pipeline_id: string
}

export interface DashboardData {
    summary: {
        total_runs: number
        completed_runs: number
        failed_runs: number
        running: number
        success_rate: number
        ci_runs: number
        web_runs: number
        ci_success_rate: number
        web_success_rate: number
        total_tests_run: number
        total_tests_passed: number
        overall_pass_rate: number
        avg_duration_seconds: number
        max_duration_seconds: number
        min_duration_seconds: number
    }
    daily_trend: DailyPoint[]
    top_modules: TopModule[]
    most_failing: TopModule[]
    recent_runs: RecentRun[]
}
