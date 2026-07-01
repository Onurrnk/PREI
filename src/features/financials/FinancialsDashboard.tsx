import React, { useState } from 'react';
import { Card } from '../../core/components/Card/Card';
import { Button } from '../../core/components/Button/Button';
import { DollarSign, TrendingUp, Briefcase, Download, Filter, Target } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import styles from './Financials.module.css';

// Mock Data
const kpiData = {
  totalRevenue: 24500000,
  totalSales: 18,
  avgDealSize: 1361111,
  commissionEarned: 735000,
  revenueGrowth: 12.5,
  salesGrowth: 8.3,
  dealGrowth: -2.1,
  commissionGrowth: 15.2
};

const salesByRegion = [
  { name: 'Downtown Dubai', value: 8500000, color: '#3b82f6' },
  { name: 'Dubai Marina', value: 6200000, color: '#10b981' },
  { name: 'Palm Jumeirah', value: 5800000, color: '#8b5cf6' },
  { name: 'Business Bay', value: 4000000, color: '#f59e0b' },
];

const salesByProject = [
  { name: 'Burj Khalifa Res.', value: 2500000, color: '#ef4444' },
  { name: 'Palm Beach Towers', value: 1800000, color: '#f59e0b' },
  { name: 'Marina Vista', value: 1200000, color: '#06b6d4' },
  { name: 'Safa Two', value: 900000, color: '#8b5cf6' },
  { name: 'Other', value: 600000, color: '#64748b' },
];

const propertyTypeData = [
  { name: 'Off-plan', value: 6500000, color: '#3b82f6' },
  { name: 'Resale', value: 3500000, color: '#f59e0b' }
];

const purposeData = [
  { name: 'Investment', value: 4000000, color: '#10b981' },
  { name: 'Golden Visa', value: 2500000, color: '#8b5cf6' },
  { name: 'CBI', value: 1000000, color: '#f43f5e' },
  { name: 'Holiday Home', value: 1500000, color: '#06b6d4' },
  { name: 'Life Style', value: 1000000, color: '#f97316' }
];

const monthlySales = [
  { month: 'Jan', revenue: 1200000 },
  { month: 'Feb', revenue: 1900000 },
  { month: 'Mar', revenue: 1500000 },
  { month: 'Apr', revenue: 2200000 },
  { month: 'May', revenue: 2800000 },
  { month: 'Jun', revenue: 2450000 },
];

const targetsData = {
  monthlyLeads: { actual: 45, target: 50 },
  monthlySales: { actual: 4, target: 5 },
  monthlyRevenue: { actual: 6500000, target: 10000000 },
  yearlyRevenue: { actual: 24500000, target: 50000000 },
};

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.customTooltip}>
        <div className={styles.tooltipLabel}>{payload[0].name || label}</div>
        <div className={styles.tooltipValue}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(payload[0].value)}
        </div>
      </div>
    );
  }
  return null;
};

export const FinancialsDashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState('YTD');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financial Performance</h1>
          <p className={styles.subtitle}>Track revenue, sales velocity, and regional distribution</p>
        </div>
        <div className={styles.headerActions}>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
          >
            <option value="Q1">Q1 2026</option>
            <option value="Q2">Q2 2026</option>
            <option value="YTD">Year to Date</option>
            <option value="1Y">Last 12 Months</option>
          </select>
          <Button variant="outline"><Filter size={16} /> Filters</Button>
          <Button variant="outline"><Download size={16} /> Export Report</Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0s' }}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Total Revenue</span>
              <div className={`${styles.kpiIcon} ${styles.iconGradientBlue}`}>
                <DollarSign size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>${(kpiData.totalRevenue / 1000000).toFixed(2)}M</div>
            <div className={styles.kpiFooter}>
              <span className={kpiData.revenueGrowth >= 0 ? styles.trendUp : styles.trendDown}>
                <TrendingUp size={14} style={{ marginRight: '4px', transform: kpiData.revenueGrowth < 0 ? 'rotate(180deg)' : 'none' }}/>
                {Math.abs(kpiData.revenueGrowth)}%
              </span>
              <span className={styles.trendText}>vs last period</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.1s' }}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Total Sales (Units)</span>
              <div className={`${styles.kpiIcon} ${styles.iconGradientGreen}`}>
                <Briefcase size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>{kpiData.totalSales}</div>
            <div className={styles.kpiFooter}>
              <span className={kpiData.salesGrowth >= 0 ? styles.trendUp : styles.trendDown}>
                <TrendingUp size={14} style={{ marginRight: '4px', transform: kpiData.salesGrowth < 0 ? 'rotate(180deg)' : 'none' }}/>
                {Math.abs(kpiData.salesGrowth)}%
              </span>
              <span className={styles.trendText}>vs last period</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.2s' }}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Conversion Rate</span>
              <div className={`${styles.kpiIcon} ${styles.iconTeal}`}>
                <Target size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>
              {((targetsData.monthlySales.actual / targetsData.monthlyLeads.actual) * 100).toFixed(1)}%
            </div>
            <div className={styles.kpiFooter}>
              <span className={styles.trendUp}>
                <TrendingUp size={14} style={{ marginRight: '4px' }}/>
                1.2%
              </span>
              <span className={styles.trendText}>vs last period</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.3s' }}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Avg. Deal Size</span>
              <div className={`${styles.kpiIcon} ${styles.iconGradientOrange}`}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>${(kpiData.avgDealSize / 1000000).toFixed(2)}M</div>
            <div className={styles.kpiFooter}>
              <span className={kpiData.dealGrowth >= 0 ? styles.trendUp : styles.trendDown}>
                <TrendingUp size={14} style={{ marginRight: '4px', transform: kpiData.dealGrowth < 0 ? 'rotate(180deg)' : 'none' }}/>
                {Math.abs(kpiData.dealGrowth)}%
              </span>
              <span className={styles.trendText}>vs last period</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.4s' }}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Commission Earned</span>
              <div className={`${styles.kpiIcon} ${styles.iconGradientPurple}`}>
                <DollarSign size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(kpiData.commissionEarned)}</div>
            <div className={styles.kpiFooter}>
              <span className={kpiData.commissionGrowth >= 0 ? styles.trendUp : styles.trendDown}>
                <TrendingUp size={14} style={{ marginRight: '4px', transform: kpiData.commissionGrowth < 0 ? 'rotate(180deg)' : 'none' }}/>
                {Math.abs(kpiData.commissionGrowth)}%
              </span>
              <span className={styles.trendText}>vs last period</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Targets & Goals */}
      <h2 className={styles.chartCardTitle} style={{ marginTop: '8px' }}>Performance Targets</h2>
      <div className={styles.targetsGrid}>
        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.4s' }}>
          <div className={styles.targetCard}>
            <div className={styles.targetHeader}>
              <span className={styles.targetTitle}>Monthly Leads</span>
              <span className={styles.targetNumbers}>{targetsData.monthlyLeads.actual} / {targetsData.monthlyLeads.target}</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.min((targetsData.monthlyLeads.actual / targetsData.monthlyLeads.target) * 100, 100)}%`, backgroundColor: '#3b82f6' }}
              />
            </div>
            <div className={styles.targetFooter}>
              <span>{Math.round((targetsData.monthlyLeads.actual / targetsData.monthlyLeads.target) * 100)}% Achieved</span>
              <span>{targetsData.monthlyLeads.target - targetsData.monthlyLeads.actual} remaining</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.5s' }}>
          <div className={styles.targetCard}>
            <div className={styles.targetHeader}>
              <span className={styles.targetTitle}>Monthly Sales (Units)</span>
              <span className={styles.targetNumbers}>{targetsData.monthlySales.actual} / {targetsData.monthlySales.target}</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.min((targetsData.monthlySales.actual / targetsData.monthlySales.target) * 100, 100)}%`, backgroundColor: '#10b981' }}
              />
            </div>
            <div className={styles.targetFooter}>
              <span>{Math.round((targetsData.monthlySales.actual / targetsData.monthlySales.target) * 100)}% Achieved</span>
              <span>{targetsData.monthlySales.target - targetsData.monthlySales.actual} remaining</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.6s' }}>
          <div className={styles.targetCard}>
            <div className={styles.targetHeader}>
              <span className={styles.targetTitle}>Monthly Revenue Target</span>
              <span className={styles.targetNumbers}>{formatCurrency(targetsData.monthlyRevenue.actual)} / {formatCurrency(targetsData.monthlyRevenue.target)}</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.min((targetsData.monthlyRevenue.actual / targetsData.monthlyRevenue.target) * 100, 100)}%`, backgroundColor: '#8b5cf6' }}
              />
            </div>
            <div className={styles.targetFooter}>
              <span>{Math.round((targetsData.monthlyRevenue.actual / targetsData.monthlyRevenue.target) * 100)}% Achieved</span>
            </div>
          </div>
        </Card>

        <Card padding="md" className={styles.animatedCard} style={{ animationDelay: '0.7s' }}>
          <div className={styles.targetCard}>
            <div className={styles.targetHeader}>
              <span className={styles.targetTitle}>Yearly Revenue Target</span>
              <span className={styles.targetNumbers}>{formatCurrency(targetsData.yearlyRevenue.actual)} / {formatCurrency(targetsData.yearlyRevenue.target)}</span>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.min((targetsData.yearlyRevenue.actual / targetsData.yearlyRevenue.target) * 100, 100)}%`, backgroundColor: '#f59e0b' }}
              />
            </div>
            <div className={styles.targetFooter}>
              <span>{Math.round((targetsData.yearlyRevenue.actual / targetsData.yearlyRevenue.target) * 100)}% Achieved</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        <Card padding="lg" className={`${styles.chartCard} ${styles.animatedCard}`} style={{ animationDelay: '0.6s' }}>
          <h3 className={styles.chartCardTitle}>Sales by Region</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByRegion}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {salesByRegion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="lg" className={`${styles.chartCard} ${styles.animatedCard}`} style={{ animationDelay: '0.7s' }}>
          <h3 className={styles.chartCardTitle}>Sales by Project</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByProject}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {salesByProject.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="lg" className={`${styles.chartCard} ${styles.animatedCard}`} style={{ animationDelay: '0.8s' }}>
          <h3 className={styles.chartCardTitle}>Off-plan vs Resale</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={propertyTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {propertyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="lg" className={`${styles.chartCard} ${styles.animatedCard}`} style={{ animationDelay: '0.9s' }}>
          <h3 className={styles.chartCardTitle}>Sales by Purpose</h3>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={purposeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {purposeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card padding="lg" className={`${styles.chartCard} ${styles.animatedCard}`} style={{ gridColumn: '1 / -1', animationDelay: '1.0s' }}>
          <h3 className={styles.chartCardTitle}>Monthly Revenue Trend</h3>
          <div className={styles.chartContainer} style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis 
                  tickFormatter={(value) => `$${value / 1000000}M`} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-secondary)' }}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-hover)' }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
