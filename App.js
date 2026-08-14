import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, Dimensions, Image } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Constants from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Picker } from '@react-native-picker/picker';
import VoiceAssistant from './src/components/VoiceAssistant';
import Badges from './src/components/Badges';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const appApiBase = String(Constants?.expoConfig?.extra?.apiBase || Constants?.manifest?.extra?.apiBase || 'https://jengaplus-backend.onrender.com');
const API_BASE = `${appApiBase.replace(/\/$/, '')}/api`;
const allowedRegistrationRoles = ['Boss', 'Salesperson', 'Driver', 'Customer'];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Login'); // Login, Register, ForgotPassword, ResetPassword, VerifyOTP, BossDashboard, SalesDashboard, Customers, AddCustomer, RecordDebt, Expenses, AddExpense, FinanceSummary, DashboardSummary, Vehicles, AddVehicle, Deliveries, AddDelivery, Suppliers, AddSupplier, EditSupplier, PurchaseOrders, AddPurchaseOrder, EditPurchaseOrder, Attendance, AddAttendance, EditAttendance, Users, EditUser
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [authStatusMessage, setAuthStatusMessage] = useState('');
  const [registerForm, setRegisterForm] = useState({ business_name: '', subdomain: '', name: '', email: '', password: '', role: 'Boss' });
  const sessionTimeoutRef = useRef(null);
  const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
  const [otpCode, setOtpCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userSession, setUserSession] = useState(null);
  const [tenantId, setTenantId] = useState(1);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanResult, setScanResult] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('back');

  const [customers, setCustomers] = useState([
    { id: 1, name: 'Marco Materials Ltd', phone: '+255755123456', address: 'Dar es Salaam', category: 'Wholesale', credit_limit: '50000000', loyalty_tier: 'Gold', created_at: '2024-01-15' },
    { id: 2, name: 'TanzaBuild Construction', phone: '+255756234567', address: 'Morogoro', category: 'Contractor', credit_limit: '30000000', loyalty_tier: 'Silver', created_at: '2024-02-10' },
    { id: 3, name: 'Arusha Retail Store', phone: '+255757345678', address: 'Arusha', category: 'Retail', credit_limit: '15000000', loyalty_tier: 'Bronze', created_at: '2024-03-05' },
    { id: 4, name: 'Mbeya Hardware Hub', phone: '+255758456789', address: 'Mbeya', category: 'Retail', credit_limit: '8000000', loyalty_tier: 'Bronze', created_at: '2024-03-20' },
    { id: 5, name: 'Kilimanjaro Developers', phone: '+255759567890', address: 'Moshi', category: 'Contractor', credit_limit: '25000000', loyalty_tier: 'Silver', created_at: '2024-04-12' }
  ]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', category: 'Retail', credit_limit: '0', loyalty_tier: 'Bronze' });
  const [debtAmount, setDebtAmount] = useState('0');
  const [debtDueDate, setDebtDueDate] = useState('');

  const [products, setProducts] = useState([
    { id: 1, category: 'Cement', name: 'Dangote Cement 50kg', unit: 'Bag', price: '18000', cost_price: '14000', stock_quantity: '245', low_stock_threshold: '50', sku: 'DANG-CEMENT-50', created_at: '2024-01-10' },
    { id: 2, category: 'Cement', name: 'Heidelberg Cement 50kg', unit: 'Bag', price: '17500', cost_price: '13500', stock_quantity: '180', low_stock_threshold: '50', sku: 'HEID-CEMENT-50', created_at: '2024-01-12' },
    { id: 3, category: 'Steel', name: '10mm Reinforcement Steel', unit: 'kg', price: '2500', cost_price: '1800', stock_quantity: '5420', low_stock_threshold: '500', sku: 'STEEL-10MM', created_at: '2024-01-15' },
    { id: 4, category: 'Steel', name: '12mm Reinforcement Steel', unit: 'kg', price: '2700', cost_price: '1950', stock_quantity: '4850', low_stock_threshold: '500', sku: 'STEEL-12MM', created_at: '2024-01-15' },
    { id: 5, category: 'Brick', name: 'Common Brick', unit: 'Piece', price: '800', cost_price: '500', stock_quantity: '12500', low_stock_threshold: '1000', sku: 'BRICK-COMMON', created_at: '2024-01-20' },
    { id: 6, category: 'Paint', name: 'Premium Acrylic Paint White 20L', unit: 'Tin', price: '85000', cost_price: '55000', stock_quantity: '42', low_stock_threshold: '10', sku: 'PAINT-ACRYLIC-20L', created_at: '2024-02-05' },
    { id: 7, category: 'Sand', name: 'Sharp Sand', unit: 'Cubic meter', price: '35000', cost_price: '22000', stock_quantity: '320', low_stock_threshold: '50', sku: 'SAND-SHARP', created_at: '2024-01-25' },
    { id: 8, category: 'Timber', name: 'Pine Timber 2x4', unit: 'Piece', price: '12000', cost_price: '8000', stock_quantity: '156', low_stock_threshold: '30', sku: 'TIMBER-2X4', created_at: '2024-02-10' }
  ]);
  const [sales, setSales] = useState([
    { id: 1, invoice_number: 'INV-2024-0001', customer_name: 'Marco Materials Ltd', customer_id: 1, total_amount: '450000', payment_status: 'Paid', payment_method: 'Bank Transfer', created_at: '2024-03-15', items: 5 },
    { id: 2, invoice_number: 'INV-2024-0002', customer_name: 'TanzaBuild Construction', customer_id: 2, total_amount: '1200000', payment_status: 'Paid', payment_method: 'Cash', created_at: '2024-03-18', items: 8 },
    { id: 3, invoice_number: 'INV-2024-0003', customer_name: 'Arusha Retail Store', customer_id: 3, total_amount: '285000', payment_status: 'Pending', payment_method: 'Credit', created_at: '2024-03-20', items: 3 },
    { id: 4, invoice_number: 'INV-2024-0004', customer_name: 'Mbeya Hardware Hub', customer_id: 4, total_amount: '165000', payment_status: 'Paid', payment_method: 'Mobile Money', created_at: '2024-03-22', items: 2 }
  ]);
  const [saleForm, setSaleForm] = useState({ customer_name: '', customer_id: '', invoice_number: '', product_id: '', quantity: '1', unit_price: '0', total_amount: '0', discount_amount: '0', tax_amount: '0', payment_method: 'Cash', payment_status: 'Paid', due_date: '', notes: '' });
  const [productForm, setProductForm] = useState({ category: '', name: '', unit: '', price: '0', stock_quantity: '0', low_stock_threshold: '10' });
  const [productSelection, setProductSelection] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [deliveryStatusForm, setDeliveryStatusForm] = useState({ status: '', proof_of_delivery_url: '' });
  const [customerDebts, setCustomerDebts] = useState([
    { id: 1, customer_id: 3, customer_name: 'Arusha Retail Store', amount: '142500', due_date: '2024-04-05', status: 'Overdue', days_overdue: 0, created_at: '2024-03-20', notes: 'Invoice INV-2024-0003' },
    { id: 2, customer_id: 2, customer_name: 'TanzaBuild Construction', amount: '0', due_date: '2024-03-25', status: 'Paid', days_overdue: 0, created_at: '2024-03-18', notes: 'Fully paid on time' },
    { id: 3, customer_id: 5, customer_name: 'Kilimanjaro Developers', amount: '385000', due_date: '2024-04-10', status: 'Pending', days_overdue: 0, created_at: '2024-03-15', notes: 'New customer, first purchase' }
  ]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ customer_id: '', debt_id: '', amount: '0', payment_method: 'Cash', notes: '' });

  const [vehicles, setVehicles] = useState([
    { id: 1, plate: 'TZA-001', type: 'Truck', capacity: '5000kg', status: 'Active', assigned_driver_id: '1', color: 'White', year: '2021', last_service: '2024-03-10' },
    { id: 2, plate: 'TZA-002', type: 'Van', capacity: '2000kg', status: 'Active', assigned_driver_id: '2', color: 'Blue', year: '2022', last_service: '2024-03-05' },
    { id: 3, plate: 'TZA-003', type: 'Pickup', capacity: '1500kg', status: 'In Maintenance', assigned_driver_id: null, color: 'Red', year: '2020', last_service: '2024-02-20' },
    { id: 4, plate: 'TZA-004', type: 'Truck', capacity: '5000kg', status: 'Active', assigned_driver_id: '3', color: 'White', year: '2023', last_service: '2024-03-12' }
  ]);
  const [vehicleForm, setVehicleForm] = useState({ plate: '', type: '', capacity: '', status: 'Active', assigned_driver_id: '' });

  const [deliveries, setDeliveries] = useState([
    { id: 1, driver_id: 1, vehicle_id: 1, customer_name: 'Marco Materials Ltd', customer_address: 'Dar es Salaam', destination: 'Port Area', status: 'Delivered', route_start: '08:30', route_end: '10:45', distance_km: '12', eta: '10:30', created_at: '2024-03-20' },
    { id: 2, driver_id: 2, vehicle_id: 2, customer_name: 'TanzaBuild Construction', customer_address: 'Morogoro', destination: 'Industrial Zone', status: 'In Transit', route_start: '09:00', route_end: null, distance_km: '45', eta: '12:00', created_at: '2024-03-22' },
    { id: 3, driver_id: 3, vehicle_id: 4, customer_name: 'Arusha Retail Store', customer_address: 'Arusha', destination: 'CBD Area', status: 'Pending', route_start: null, route_end: null, distance_km: '25', eta: '14:00', created_at: '2024-03-22' },
    { id: 4, driver_id: 1, vehicle_id: 1, customer_name: 'Kilimanjaro Developers', customer_address: 'Moshi', destination: 'Construction Site', status: 'Delivered', route_start: '06:00', route_end: '09:30', distance_km: '80', eta: '09:00', created_at: '2024-03-21' }
  ]);
  const [deliveryForm, setDeliveryForm] = useState({ driver_id: '', vehicle_id: '', customer_name: '', customer_address: '', destination: '', status: 'Pending', route_start: '', route_end: '', distance_km: '0', eta: '' });

  const [suppliers, setSuppliers] = useState([
    { id: 1, name: 'East Africa Cement Co.', contact_person: 'Mr. Kimani', phone: '+255789101112', email: 'sales@eacement.com', address: 'Dar es Salaam', rating: '4.8', notes: 'Reliable supplier', payment_terms: 'Net 30', created_at: '2024-01-10' },
    { id: 2, name: 'Tanzania Steel Mills', contact_person: 'Ms. Upendo', phone: '+255789202122', email: 'supply@tsteel.com', address: 'Morogoro', rating: '4.5', notes: 'Bulk discount available', payment_terms: 'Net 15', created_at: '2024-01-15' },
    { id: 3, name: 'Coastal Paint Industries', contact_person: 'Mr. Joseph', phone: '+255789303132', email: 'order@cpaint.com', address: 'Dar es Salaam', rating: '4.2', notes: 'Good quality paint', payment_terms: 'Net 45', created_at: '2024-02-05' },
    { id: 4, name: 'Northern Timber Trading', contact_person: 'Ms. Grace', phone: '+255789404142', email: 'supply@nttimber.com', address: 'Arusha', rating: '4.6', notes: 'High quality timber', payment_terms: 'Net 30', created_at: '2024-02-10' }
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setInitializing(false);
    }, 3200);

    return () => clearTimeout(timeout);
  }, []);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', rating: '0', notes: '' });
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantForm, setTenantForm] = useState({ business_name: '', subdomain: '', subscription_status: 'Active' });

  const [purchaseOrders, setPurchaseOrders] = useState([
    { id: 1, supplier_id: 1, supplier_name: 'East Africa Cement Co.', order_number: 'PO-2024-0001', status: 'Delivered', total_amount: '9000000', currency: 'TZS', expected_delivery_date: '2024-03-25', actual_delivery_date: '2024-03-24', quantity: '500', unit: 'Bags', created_at: '2024-03-10' },
    { id: 2, supplier_id: 2, supplier_name: 'Tanzania Steel Mills', order_number: 'PO-2024-0002', status: 'In Transit', total_amount: '5500000', currency: 'TZS', expected_delivery_date: '2024-03-28', actual_delivery_date: null, quantity: '2200', unit: 'kg', created_at: '2024-03-15' },
    { id: 3, supplier_id: 3, supplier_name: 'Coastal Paint Industries', order_number: 'PO-2024-0003', status: 'Pending', total_amount: '2125000', currency: 'TZS', expected_delivery_date: '2024-04-05', actual_delivery_date: null, quantity: '25', unit: 'Tins', created_at: '2024-03-18' },
    { id: 4, supplier_id: 4, supplier_name: 'Northern Timber Trading', order_number: 'PO-2024-0004', status: 'Delivered', total_amount: '1872000', currency: 'TZS', expected_delivery_date: '2024-03-22', actual_delivery_date: '2024-03-22', quantity: '156', unit: 'Pieces', created_at: '2024-03-12' }
  ]);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({ supplier_id: '', order_number: '', status: 'Pending', total_amount: '0', currency: 'TZS', expected_delivery_date: '', notes: '' });

  const [attendanceRecords, setAttendanceRecords] = useState([
    { id: 1, user_id: 1, user_name: 'John Mkwanda', work_date: '2024-03-22', status: 'Present', check_in: '08:00', check_out: '17:00', hours_worked: '9', notes: '' },
    { id: 2, user_id: 2, user_name: 'Sarah Mwase', work_date: '2024-03-22', status: 'Present', check_in: '08:15', check_out: '16:45', hours_worked: '8.5', notes: 'Field visit' },
    { id: 3, user_id: 3, user_name: 'David Kipchoge', work_date: '2024-03-22', status: 'Present', check_in: '06:30', check_out: '18:00', hours_worked: '11.5', notes: 'Long delivery route' },
    { id: 4, user_id: 4, user_name: 'Grace Nakibuuka', work_date: '2024-03-22', status: 'Present', check_in: '08:00', check_out: '17:00', hours_worked: '9', notes: '' },
    { id: 5, user_id: 5, user_name: 'Kwame Asante', work_date: '2024-03-22', status: 'Absent', check_in: null, check_out: null, hours_worked: '0', notes: 'Medical leave' }
  ]);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({ user_id: '', work_date: '', status: 'Present', check_in: '', check_out: '', notes: '' });

  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Transport', vendor: 'Dar Fuel Station', amount: '450000', currency: 'TZS', payment_method: 'Cash', expense_date: '2024-03-20', description: 'Vehicle fuel - Truck TZA-001', status: 'Approved', created_at: '2024-03-20' },
    { id: 2, category: 'Utilities', vendor: 'TANESCO', amount: '125000', currency: 'TZS', payment_method: 'Bank Transfer', expense_date: '2024-03-15', description: 'March electricity bill', status: 'Approved', created_at: '2024-03-15' },
    { id: 3, category: 'Maintenance', vendor: 'Auto Repair Services', amount: '280000', currency: 'TZS', payment_method: 'Cash', expense_date: '2024-03-18', description: 'Truck maintenance and repairs', status: 'Pending', created_at: '2024-03-18' },
    { id: 4, category: 'Office', vendor: 'Office Supplies Ltd', amount: '95000', currency: 'TZS', payment_method: 'Cash', expense_date: '2024-03-19', description: 'Stationery and office supplies', status: 'Approved', created_at: '2024-03-19' }
  ]);
  const [expenseForm, setExpenseForm] = useState({ category: '', vendor: '', amount: '0', currency: 'TZS', payment_method: 'Cash', expense_date: '', description: '' });
  const [payments, setPayments] = useState([
    { id: 1, customer_id: 1, customer_name: 'Marco Materials Ltd', amount: '450000', payment_method: 'Bank Transfer', invoice_number: 'INV-2024-0001', status: 'Completed', paid_at: '2024-03-16', due_date: '2024-03-20' },
    { id: 2, customer_id: 2, customer_name: 'TanzaBuild Construction', amount: '1200000', payment_method: 'Cash', invoice_number: 'INV-2024-0002', status: 'Completed', paid_at: '2024-03-19', due_date: '2024-03-25' },
    { id: 3, customer_id: 4, customer_name: 'Mbeya Hardware Hub', amount: '165000', payment_method: 'Mobile Money', invoice_number: 'INV-2024-0004', status: 'Completed', paid_at: '2024-03-22', due_date: '2024-03-22' },
    { id: 4, customer_id: 3, customer_name: 'Arusha Retail Store', amount: '142500', payment_method: 'Partial Payment', invoice_number: 'INV-2024-0003', status: 'Partial', paid_at: '2024-03-21', due_date: '2024-04-05' }
  ]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [users, setUsers] = useState([
    { id: 1, name: 'John Mkwanda', email: 'john.mkwanda@jengaplus.com', role: 'Boss', phone: '+255755111111', department: 'Management', status: 'Active', created_at: '2024-01-05' },
    { id: 2, name: 'Sarah Mwase', email: 'sarah.mwase@jengaplus.com', role: 'Salesperson', phone: '+255755222222', department: 'Sales', status: 'Active', created_at: '2024-01-10' },
    { id: 3, name: 'David Kipchoge', email: 'david.kipchoge@jengaplus.com', role: 'Driver', phone: '+255755333333', department: 'Logistics', status: 'Active', created_at: '2024-01-12' },
    { id: 4, name: 'Grace Nakibuuka', email: 'grace.nakibuuka@jengaplus.com', role: 'Salesperson', phone: '+255755444444', department: 'Sales', status: 'Active', created_at: '2024-02-01' },
    { id: 5, name: 'Kwame Asante', email: 'kwame.asante@jengaplus.com', role: 'Driver', phone: '+255755555555', department: 'Logistics', status: 'Active', created_at: '2024-02-05' }
  ]);
  const [selectedUserRecord, setSelectedUserRecord] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Salesperson' });
  const [paymentSummary, setPaymentSummary] = useState({ total_paid: '1957500', total_pending: '142500', payment_rate: '93.2', avg_payment_days: '4' });
  const [paymentSummaryChart, setPaymentSummaryChart] = useState(null);
  const [agingReport, setAgingReport] = useState([]);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [financeSummary, setFinanceSummary] = useState({ total_revenue: '2100000', total_expenses: '950000', gross_profit: '1150000', profit_margin: '54.8%', cash_position: '1200000', accounts_receivable: '142500' });
  const [dashboardSummary, setDashboardSummary] = useState({ total_customers: '5', active_sales: '4', pending_deliveries: '1', low_stock_items: '3', total_inventory_value: '48500000', pending_payments: '142500' });
  const [bossSalesSummary, setBossSalesSummary] = useState({ daily: 450000, weekly: 1837500, monthly: 2100000 });
  const [growthReport, setGrowthReport] = useState(null);
  const [adminOverview, setAdminOverview] = useState(null);
  const [schedulerResult, setSchedulerResult] = useState(null);
  const [adminTenants, setAdminTenants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tenantStatusLoading, setTenantStatusLoading] = useState(false);
  const userRole = userSession?.role || '';
  const isBossUser = ['Boss', 'Manager', 'SuperAdmin'].includes(userRole);
  const isSellerUser = userRole === 'Salesperson';
  const dashboardTitle = isBossUser ? 'Executive Command Center' : isSellerUser ? 'Sales Hub' : 'Business Dashboard';
  const dashboardThemeStyle = isBossUser ? styles.bossDashboardContainer : styles.sellerDashboardContainer;

  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE}/customers/${tenantId}`);
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const handleBarcodeScanned = (scanningResult) => {
    if (!scanningResult || scanResult) return;
    const { data, type } = scanningResult;
    setScanResult({ type, data });
    Alert.alert('Barcode Scanned', `Type: ${type}\nData: ${data}`);
  };

  const saveCustomer = async () => {
    if (!customerForm.name) {
      return Alert.alert('Validation', 'Customer name is required.');
    }
    try {
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...customerForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Customer created successfully.');
        setCustomerForm({ name: '', phone: '', address: '', category: 'Retail', credit_limit: '0', loyalty_tier: 'Bronze' });
        setCurrentScreen('Customers');
        loadCustomers();
      } else {
        Alert.alert('API error', data.error || 'Unable to save customer');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const removeCustomer = async (customer) => {
    try {
      const response = await fetch(`${API_BASE}/customers/${customer.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadCustomers();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete customer');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadCustomerForEdit = (customer) => {
    setSelectedCustomer(customer);
    setCustomerForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      category: customer.category || 'Retail',
      credit_limit: (customer.credit_limit || 0).toString(),
      loyalty_tier: customer.loyalty_tier || 'Bronze'
    });
    setCurrentScreen('EditCustomer');
  };

  const updateCustomer = async () => {
    if (!selectedCustomer || !selectedCustomer.id) {
      return Alert.alert('Validation', 'Select a customer to update.');
    }
    if (!customerForm.name) {
      return Alert.alert('Validation', 'Customer name is required.');
    }
    try {
      const response = await fetch(`${API_BASE}/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...customerForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Customer updated successfully.');
        setSelectedCustomer(null);
        setCustomerForm({ name: '', phone: '', address: '', category: 'Retail', credit_limit: '0', loyalty_tier: 'Bronze' });
        setCurrentScreen('Customers');
        loadCustomers();
      } else {
        Alert.alert('API error', data.error || 'Unable to update customer');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const loadExpenseForEdit = (expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      category: expense.category || '',
      vendor: expense.vendor || '',
      amount: (expense.amount || 0).toString(),
      currency: expense.currency || 'TZS',
      payment_method: expense.payment_method || 'Cash',
      expense_date: expense.expense_date || '',
      description: expense.description || ''
    });
    setCurrentScreen('EditExpense');
  };

  const updateExpense = async () => {
    if (!selectedExpense || !selectedExpense.id) {
      return Alert.alert('Validation', 'Choose an expense entry first.');
    }
    if (!expenseForm.category || !expenseForm.amount) {
      return Alert.alert('Validation', 'Expense category and amount are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/expenses/${selectedExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...expenseForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Expense updated successfully.');
        setSelectedExpense(null);
        setExpenseForm({ category: '', vendor: '', amount: '0', currency: 'TZS', payment_method: 'Cash', expense_date: '', description: '' });
        setCurrentScreen('Expenses');
        fetchExpenses();
      } else {
        Alert.alert('API error', data.error || 'Unable to update expense');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deleteExpense = async (expense) => {
    try {
      const response = await fetch(`${API_BASE}/expenses/${expense.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        fetchExpenses();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete expense');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await authFetch(`${API_BASE}/users/${tenantId}`);
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      } else {
        Alert.alert('Load error', data.error || 'Unable to load team members');
      }
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) {
      return Alert.alert('Validation', 'All team member fields are required.');
    }
    try {
      const response = await authFetch(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, ...userForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Team member added successfully.');
        setUserForm({ name: '', email: '', password: '', role: 'Salesperson' });
        setCurrentScreen('Users');
        loadUsers();
      } else {
        Alert.alert('API error', data.error || 'Unable to save team member');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadUserForEdit = (user) => {
    setSelectedUserRecord(user);
    setUserForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Salesperson'
    });
    setCurrentScreen('EditUser');
  };

  const updateUser = async () => {
    if (!selectedUserRecord || !selectedUserRecord.id) return Alert.alert('Validation', 'Choose a team member to update.');
    try {
      const response = await authFetch(`${API_BASE}/users/${selectedUserRecord.id}`, {
        method: 'PUT',
        body: JSON.stringify({ tenant_id: tenantId, ...userForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Team member updated successfully.');
        setSelectedUserRecord(null);
        setUserForm({ name: '', email: '', password: '', role: 'Salesperson' });
        setCurrentScreen('Users');
        loadUsers();
      } else {
        Alert.alert('API error', data.error || 'Unable to update team member');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deleteUser = async (user) => {
    try {
      const response = await authFetch(`${API_BASE}/users/${user.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadUsers();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete team member');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadDebtForEdit = (debt) => {
    setSelectedDebt(debt);
    setDebtAmount(debt.amount?.toString() || '0');
    setDebtDueDate(debt.due_date || '');
    setCurrentScreen('EditDebt');
  };

  const updateDebt = async () => {
    if (!selectedDebt) return Alert.alert('Validation', 'Select a debt entry first.');
    try {
      const response = await fetch(`${API_BASE}/customer-debts/${selectedDebt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, sale_reference: selectedDebt.sale_reference, amount: parseFloat(debtAmount), due_date: debtDueDate, status: selectedDebt.status || 'Pending' })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Debt updated successfully.');
        setSelectedDebt(null);
        setDebtAmount('0');
        setDebtDueDate('');
        loadDebts();
        setCurrentScreen('CustomerDebts');
      } else {
        Alert.alert('API error', data.error || 'Unable to update debt');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deleteDebt = async (debt) => {
    try {
      const response = await fetch(`${API_BASE}/customer-debts/${debt.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadDebts();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete debt');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadPaymentForEdit = (payment) => {
    setSelectedPayment(payment);
    setPaymentForm({
      customer_id: payment.customer_id?.toString() || payment.customerId?.toString() || '',
      debt_id: payment.debt_id?.toString() || '',
      amount: payment.amount?.toString() || '0',
      payment_method: payment.payment_method || 'Cash',
      notes: payment.notes || ''
    });
    setCurrentScreen('EditPayment');
  };

  const updatePayment = async () => {
    if (!selectedPayment) return Alert.alert('Validation', 'Select a payment record first.');
    try {
      const response = await fetch(`${API_BASE}/customer-payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, customer_id: paymentForm.customer_id || selectedPayment.customer_id, debt_id: paymentForm.debt_id || null, amount: parseFloat(paymentForm.amount), payment_method: paymentForm.payment_method, notes: paymentForm.notes })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Payment updated successfully.');
        setSelectedPayment(null);
        setPaymentForm({ customer_id: '', debt_id: '', amount: '0', payment_method: 'Cash', notes: '' });
        loadPayments();
        setCurrentScreen('Payments');
      } else {
        Alert.alert('API error', data.error || 'Unable to update payment');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deletePayment = async (payment) => {
    try {
      const response = await fetch(`${API_BASE}/customer-payments/${payment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadPayments();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete payment');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const recordDebt = async (customer) => {
    if (!debtAmount || !debtDueDate) {
      return Alert.alert('Validation', 'Amount and due date are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/customers/${customer.id}/debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, sale_reference: `Invoice ${Date.now()}`, amount: parseFloat(debtAmount), due_date: debtDueDate })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Debt recorded successfully.');
        setDebtAmount('0');
        setDebtDueDate('');
        setSelectedCustomer(null);
      } else {
        Alert.alert('API error', data.error || 'Unable to record debt');
      }
    } catch (error) {
      Alert.alert('Debt error', error.message);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await fetch(`${API_BASE}/expenses/${tenantId}`);
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await fetch(`${API_BASE}/customers/${tenantId}/payments`);
      const data = await response.json();
      const paymentsArray = Array.isArray(data) ? data : [];
      setPayments(paymentsArray);
      calculatePaymentSummary(paymentsArray);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const calculatePaymentSummary = (paymentData = payments) => {
    const paymentsArray = paymentData || [];
    const totalAmount = paymentsArray.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const totalPayments = paymentsArray.length;
    const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;
    const mostRecent = paymentsArray.reduce((latest, payment) => {
      const date = payment.paid_at || payment.created_at;
      return !date || new Date(date) <= new Date(latest) ? latest : date;
    }, null);
    const recentPayments = paymentsArray.slice(-6);
    const chartLabels = recentPayments.map((payment, index) => {
      const paidAt = payment.paid_at || payment.created_at || '';
      return paidAt ? paidAt.split('T')[0] : `P${index + 1}`;
    });
    const chartData = recentPayments.map((payment) => parseFloat(payment.amount || 0));
    const methodCounts = paymentsArray.reduce((acc, payment) => {
      const method = payment.payment_method || 'Other';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});
    const pieData = Object.keys(methodCounts).map((method, index) => ({
      name: method,
      population: methodCounts[method],
      color: ['#2563EB', '#C2410C', '#10B981', '#F59E0B', '#8B5CF6'][index % 5],
      legendFontColor: '#64748B',
      legendFontSize: 12
    }));

    setPaymentSummary({
      total_payments: totalPayments,
      total_amount: totalAmount,
      average_payment: averagePayment,
      last_payment_date: mostRecent || 'No payments yet'
    });
    setPaymentSummaryChart({
      bar: { labels: chartLabels, data: chartData },
      pie: pieData
    });
  };

  const loadCustomerAgingReport = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/aging/${tenantId}`);
      const data = await response.json();
      setAgingReport(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadCustomerDebtReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/${tenantId}`);
      const data = await response.json();
      const report = {
        revenue: Number(data.total_revenue) || 0,
        expenses: Number(data.total_expenses) || 0,
        outstanding: Number(data.total_outstanding) || 0,
        total_sales: Number(data.total_sales) || 0,
      };
      setReportData(report);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) {
      return Alert.alert('Validation', 'Expense category and amount are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...expenseForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Expense recorded successfully.');
        setExpenseForm({ category: '', vendor: '', amount: '0', currency: 'TZS', payment_method: 'Cash', expense_date: '', description: '' });
        setCurrentScreen('Expenses');
        fetchExpenses();
      } else {
        Alert.alert('API error', data.error || 'Unable to save expense');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_BASE}/products/${tenantId}`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const updateSaleTotals = (field, value) => {
    const nextState = { ...saleForm, [field]: value };
    const quantity = parseFloat(nextState.quantity || 0);
    const unitPrice = parseFloat(nextState.unit_price || 0);
    const discount = parseFloat(nextState.discount_amount || 0);
    const tax = parseFloat(nextState.tax_amount || 0);
    const baseTotal = quantity * unitPrice;
    const total = Math.max(baseTotal - discount + tax, 0);
    setSaleForm({ ...nextState, total_amount: total.toFixed(2) });
  };

  const selectProduct = (product) => {
    const productPrice = parseFloat(product.price) || 0;
    setProductSelection(product);
    setSaleForm((prev) => ({
      ...prev,
      product_id: product.id.toString(),
      unit_price: productPrice.toString(),
      quantity: '1',
      total_amount: productPrice.toFixed(2)
    }));
  };

  const loadSales = async () => {
    try {
      const response = await fetch(`${API_BASE}/sales/${tenantId}`);
      const data = await response.json();
      setSales(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadSaleDetails = async (saleId) => {
    try {
      const response = await fetch(`${API_BASE}/sales/${tenantId}/${saleId}`);
      const data = await response.json();
      if (!data.sale) {
        return Alert.alert('Not found', 'Sale record was not found.');
      }
      setSelectedSale({ ...data.sale, line_items: data.items || [] });
      setCurrentScreen('SaleReceipt');
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadDeliveryDetails = async (deliveryId) => {
    try {
      const response = await fetch(`${API_BASE}/deliveries/${tenantId}/${deliveryId}`);
      const data = await response.json();
      setSelectedDelivery(data.delivery);
      setDeliveryStatusForm({ status: data.delivery.status || '', proof_of_delivery_url: data.delivery.proof_of_delivery_url || '' });
      setCurrentScreen('DeliveryDetail');
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const updateDeliveryStatus = async () => {
    if (!selectedDelivery) {
      return Alert.alert('Validation', 'Select a delivery first.');
    }
    try {
      const response = await fetch(`${API_BASE}/deliveries/${selectedDelivery.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, status: deliveryStatusForm.status, proof_of_delivery_url: deliveryStatusForm.proof_of_delivery_url })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Delivery status updated.');
        setSelectedDelivery(data.delivery);
        loadDeliveries();
      } else {
        Alert.alert('API error', data.error || 'Unable to update status');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const saveSale = async () => {
    if (!saleForm.customer_name || !saleForm.total_amount) {
      return Alert.alert('Validation', 'Customer and total amount are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          salesperson_id: 0,
          customer_id: saleForm.customer_id || null,
          customer_name: saleForm.customer_name,
          invoice_number: saleForm.invoice_number || `INV-${Date.now()}`,
          total_amount: parseFloat(saleForm.total_amount),
          discount_amount: parseFloat(saleForm.discount_amount || 0),
          tax_amount: parseFloat(saleForm.tax_amount || 0),
          payment_method: saleForm.payment_method,
          payment_status: saleForm.payment_status,
          due_date: saleForm.due_date || null,
          notes: saleForm.notes,
          line_items: [{
            product_id: productSelection?.id || null,
            quantity: parseInt(saleForm.quantity, 10),
            unit_price: parseFloat(saleForm.unit_price),
            discount: parseFloat(saleForm.discount_amount || 0),
            line_total: parseFloat(saleForm.quantity) * parseFloat(saleForm.unit_price)
          }]
        })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Sale recorded successfully.');
        setSaleForm({ customer_name: '', customer_id: '', invoice_number: '', product_id: '', quantity: '1', unit_price: '0', total_amount: '0', discount_amount: '0', tax_amount: '0', payment_method: 'Cash', payment_status: 'Paid', due_date: '', notes: '' });
        setProductSelection(null);
        setCurrentScreen('SalesDashboard');
        loadSales();
      } else {
        Alert.alert('API error', data.error || 'Unable to save sale');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const saveProduct = async () => {
    if (!productForm.name || !productForm.price) {
      return Alert.alert('Validation', 'Product name and price are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...productForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Product added successfully.');
        setProductForm({ category: '', name: '', unit: '', price: '0', stock_quantity: '0', low_stock_threshold: '10' });
        setCurrentScreen('Products');
        loadProducts();
      } else {
        Alert.alert('API error', data.error || 'Unable to save product');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadDebts = async () => {
    try {
      const response = await fetch(`${API_BASE}/customers/${tenantId}/debts`);
      const data = await response.json();
      setCustomerDebts(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadCustomerLedger = async (customerId) => {
    try {
      const response = await fetch(`${API_BASE}/customers/${tenantId}/ledger/${customerId}`);
      const data = await response.json();
      setLedgerEntries({ customerId, ...data });
      setPaymentForm((prev) => ({ ...prev, customer_id: customerId.toString(), debt_id: '', amount: '0', payment_method: 'Cash', notes: '' }));
      setCurrentScreen('CustomerLedger');
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const applyPayment = async () => {
    if (!ledgerEntries?.customerId || !paymentForm.amount) {
      return Alert.alert('Validation', 'Select a customer ledger and payment amount.');
    }
    try {
      const response = await fetch(`${API_BASE}/customers/${ledgerEntries.customerId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, debt_id: paymentForm.debt_id || null, amount: parseFloat(paymentForm.amount), payment_method: paymentForm.payment_method, notes: paymentForm.notes })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Payment applied successfully.');
        setPaymentForm({ debt_id: '', amount: '0', payment_method: 'Cash', notes: '' });
        setCurrentScreen('CustomerDebts');
        loadDebts();
      } else {
        Alert.alert('API error', data.error || 'Unable to apply payment');
      }
    } catch (error) {
      Alert.alert('Payment error', error.message);
    }
  };

  const savePayment = async () => {
    if (!paymentForm.customer_id || !paymentForm.amount) {
      return Alert.alert('Validation', 'Customer and amount are required for a payment.');
    }
    try {
      const response = await fetch(`${API_BASE}/customers/${paymentForm.customer_id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, debt_id: paymentForm.debt_id || null, amount: parseFloat(paymentForm.amount), payment_method: paymentForm.payment_method, notes: paymentForm.notes })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Payment recorded successfully.');
        setPaymentForm({ customer_id: '', debt_id: '', amount: '0', payment_method: 'Cash', notes: '' });
        loadPayments();
        setCurrentScreen('Payments');
      } else {
        Alert.alert('API error', data.error || 'Unable to save payment');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await fetch(`${API_BASE}/vehicles/${tenantId}`);
      const data = await response.json();
      setVehicles(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveVehicle = async () => {
    if (!vehicleForm.plate || !vehicleForm.type) {
      return Alert.alert('Validation', 'Plate and type are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...vehicleForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Vehicle registered successfully.');
        setVehicleForm({ plate: '', type: '', capacity: '', status: 'Active', assigned_driver_id: '' });
        setCurrentScreen('Vehicles');
        loadVehicles();
      } else {
        Alert.alert('API error', data.error || 'Unable to save vehicle');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadDeliveries = async () => {
    try {
      const response = await fetch(`${API_BASE}/deliveries/${tenantId}`);
      const data = await response.json();
      setDeliveries(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveDelivery = async () => {
    if (!deliveryForm.destination || !deliveryForm.customer_name) {
      return Alert.alert('Validation', 'Destination and customer name are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...deliveryForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Delivery created successfully.');
        setDeliveryForm({ driver_id: '', vehicle_id: '', customer_name: '', customer_address: '', destination: '', status: 'Pending', route_start: '', route_end: '', distance_km: '0', eta: '' });
        setCurrentScreen('Deliveries');
        loadDeliveries();
      } else {
        Alert.alert('API error', data.error || 'Unable to create delivery');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE}/suppliers/${tenantId}`);
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveSupplier = async () => {
    if (!supplierForm.name) return Alert.alert('Validation', 'Supplier name is required.');
    try {
      const response = await fetch(`${API_BASE}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...supplierForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Supplier created successfully.');
        setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '', rating: '0', notes: '' });
        setCurrentScreen('Suppliers');
        loadSuppliers();
      } else {
        Alert.alert('API error', data.error || 'Unable to save supplier');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadSupplierForEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierForm({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      rating: (supplier.rating || 0).toString(),
      notes: supplier.notes || ''
    });
    setCurrentScreen('EditSupplier');
  };

  const updateSupplier = async () => {
    if (!selectedSupplier) return Alert.alert('Validation', 'Select a supplier first.');
    try {
      const response = await fetch(`${API_BASE}/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...supplierForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Supplier updated successfully.');
        setSelectedSupplier(null);
        setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '', rating: '0', notes: '' });
        setCurrentScreen('Suppliers');
        loadSuppliers();
      } else {
        Alert.alert('API error', data.error || 'Unable to update supplier');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deleteSupplier = async (supplier) => {
    try {
      const response = await fetch(`${API_BASE}/suppliers/${supplier.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadSuppliers();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete supplier');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/purchase-orders/${tenantId}`);
      const data = await response.json();
      setPurchaseOrders(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const savePurchaseOrder = async () => {
    if (!purchaseOrderForm.order_number || !purchaseOrderForm.supplier_id) {
      return Alert.alert('Validation', 'Order number and supplier are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...purchaseOrderForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Purchase order created successfully.');
        setPurchaseOrderForm({ supplier_id: '', order_number: '', status: 'Pending', total_amount: '0', currency: 'TZS', expected_delivery_date: '', notes: '' });
        setCurrentScreen('PurchaseOrders');
        loadPurchaseOrders();
      } else {
        Alert.alert('API error', data.error || 'Unable to save purchase order');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadPurchaseOrderForEdit = (order) => {
    setSelectedPurchaseOrder(order);
    setPurchaseOrderForm({
      supplier_id: order.supplier_id?.toString() || '',
      order_number: order.order_number || '',
      status: order.status || 'Pending',
      total_amount: (order.total_amount || 0).toString(),
      currency: order.currency || 'TZS',
      expected_delivery_date: order.expected_delivery_date || '',
      notes: order.notes || ''
    });
    setCurrentScreen('EditPurchaseOrder');
  };

  const updatePurchaseOrder = async () => {
    if (!selectedPurchaseOrder) return Alert.alert('Validation', 'Select an order first.');
    try {
      const response = await fetch(`${API_BASE}/purchase-orders/${selectedPurchaseOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...purchaseOrderForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Purchase order updated successfully.');
        setSelectedPurchaseOrder(null);
        setPurchaseOrderForm({ supplier_id: '', order_number: '', status: 'Pending', total_amount: '0', currency: 'TZS', expected_delivery_date: '', notes: '' });
        setCurrentScreen('PurchaseOrders');
        loadPurchaseOrders();
      } else {
        Alert.alert('API error', data.error || 'Unable to update purchase order');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deletePurchaseOrder = async (order) => {
    try {
      const response = await fetch(`${API_BASE}/purchase-orders/${order.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadPurchaseOrders();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete purchase order');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadAttendance = async () => {
    try {
      const response = await fetch(`${API_BASE}/attendance/${tenantId}`);
      const data = await response.json();
      setAttendanceRecords(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const saveAttendance = async () => {
    if (!attendanceForm.user_id || !attendanceForm.work_date) {
      return Alert.alert('Validation', 'Employee and work date are required.');
    }
    try {
      const response = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...attendanceForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Attendance saved successfully.');
        setAttendanceForm({ user_id: '', work_date: '', status: 'Present', check_in: '', check_out: '', notes: '' });
        setCurrentScreen('Attendance');
        loadAttendance();
      } else {
        Alert.alert('API error', data.error || 'Unable to save attendance');
      }
    } catch (error) {
      Alert.alert('Save error', error.message);
    }
  };

  const loadAttendanceForEdit = (record) => {
    setSelectedAttendance(record);
    setAttendanceForm({
      user_id: record.user_id?.toString() || '',
      work_date: record.work_date || '',
      status: record.status || 'Present',
      check_in: record.check_in || '',
      check_out: record.check_out || '',
      notes: record.notes || ''
    });
    setCurrentScreen('EditAttendance');
  };

  const updateAttendance = async () => {
    if (!selectedAttendance) return Alert.alert('Validation', 'Select an attendance record first.');
    try {
      const response = await fetch(`${API_BASE}/attendance/${selectedAttendance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, ...attendanceForm })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Attendance updated successfully.');
        setSelectedAttendance(null);
        setAttendanceForm({ user_id: '', work_date: '', status: 'Present', check_in: '', check_out: '', notes: '' });
        setCurrentScreen('Attendance');
        loadAttendance();
      } else {
        Alert.alert('API error', data.error || 'Unable to update attendance');
      }
    } catch (error) {
      Alert.alert('Update error', error.message);
    }
  };

  const deleteAttendance = async (record) => {
    try {
      const response = await fetch(`${API_BASE}/attendance/${record.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Deleted', data.message);
        loadAttendance();
      } else {
        Alert.alert('API error', data.error || 'Unable to delete attendance record');
      }
    } catch (error) {
      Alert.alert('Delete error', error.message);
    }
  };

  const loadDashboardSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/${tenantId}`);
      const data = await response.json();
      setDashboardSummary(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const loadBossMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/sales-summary?tenantId=${tenantId}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const sdata = await res.json();
        setBossSalesSummary(sdata);
      }
    } catch (e) {
      console.warn('Boss metrics load failed', e.message || e);
    }
    try {
      const r = await fetch(`${API_BASE}/reports/growth?tenantId=${tenantId}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) {
        const g = await r.json();
        setGrowthReport(g);
      }
    } catch (e) {
      console.warn('Growth report load failed', e.message || e);
    }
  };

  const screenRoleAccess = {
    Login: ['Guest'],
    Register: ['Guest'],
    ForgotPassword: ['Guest'],
    ResetPassword: ['Guest'],
    VerifyOTP: ['Guest'],
    BossDashboard: ['Boss', 'Manager', 'SuperAdmin'],
    SalesDashboard: ['Salesperson', 'Manager', 'SuperAdmin'],
    Deliveries: ['Driver', 'Manager', 'SuperAdmin'],
    Vehicles: ['Driver', 'Manager', 'SuperAdmin'],
    Customers: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    AddCustomer: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    EditCustomer: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    RecordDebt: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    Expenses: ['Boss', 'Manager', 'SuperAdmin'],
    AddExpense: ['Boss', 'Manager', 'SuperAdmin'],
    EditExpense: ['Boss', 'Manager', 'SuperAdmin'],
    FinanceSummary: ['Boss', 'Manager', 'SuperAdmin'],
    Reports: ['Boss', 'Manager', 'SuperAdmin'],
    Users: ['Boss', 'Manager', 'SuperAdmin'],
    EditUser: ['Boss', 'Manager', 'SuperAdmin'],
    Products: ['Boss', 'Manager', 'SuperAdmin'],
    AddProduct: ['Boss', 'Manager', 'SuperAdmin'],
    ScanBarcode: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    CustomerDebts: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    Payments: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    PaymentSummary: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    CustomerAging: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    NewPayment: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    EditPayment: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    CustomerLedger: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    PurchaseOrders: ['Boss', 'Manager', 'SuperAdmin'],
    AddPurchaseOrder: ['Boss', 'Manager', 'SuperAdmin'],
    EditPurchaseOrder: ['Boss', 'Manager', 'SuperAdmin'],
    Attendance: ['Boss', 'Manager', 'SuperAdmin'],
    AddAttendance: ['Boss', 'Manager', 'SuperAdmin'],
    EditAttendance: ['Boss', 'Manager', 'SuperAdmin'],
    Suppliers: ['Boss', 'Manager', 'SuperAdmin'],
    AddSupplier: ['Boss', 'Manager', 'SuperAdmin'],
    EditSupplier: ['Boss', 'Manager', 'SuperAdmin'],
    BulkImport: ['Boss', 'Manager', 'SuperAdmin'],
    DashboardSummary: ['Boss', 'Manager', 'Salesperson', 'SuperAdmin'],
    AdminDashboard: ['SuperAdmin'],
    TenantManagement: ['SuperAdmin'],
    CreateTenant: ['SuperAdmin'],
    TenantDetails: ['SuperAdmin'],
  };

  const getDefaultScreenForRole = (role) => {
    if (role === 'SuperAdmin') return 'AdminDashboard';
    if (role === 'Manager' || role === 'Boss') return 'BossDashboard';
    if (role === 'Salesperson') return 'SalesDashboard';
    if (role === 'Driver') return 'Deliveries';
    return 'Login';
  };

  const isScreenAllowed = (screen) => {
    if (!screen) return false;
    if (!userSession) {
      return ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'VerifyOTP'].includes(screen);
    }
    const allowed = screenRoleAccess[screen];
    if (!allowed) return true;
    return allowed.includes(userSession.role);
  };

  useEffect(() => {
    if (!isScreenAllowed(currentScreen)) {
      setCurrentScreen(getDefaultScreenForRole(userSession?.role));
    }
  }, [currentScreen, userSession]);

  const loadFinanceSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/finance/summary/${tenantId}`);
      const data = await response.json();
      setFinanceSummary(data);
    } catch (error) {
      Alert.alert('Load error', error.message);
    }
  };

  const clearSessionTimeout = () => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  };

  const handleLogout = () => {
    clearSessionTimeout();
    setEmail('');
    setPassword('');
    setAuthToken(null);
    setUserSession(null);
    setCurrentScreen('Login');
  };

  const startSessionTimeout = () => {
    clearSessionTimeout();
    if (!authToken || !userSession) return;
    sessionTimeoutRef.current = setTimeout(() => {
      handleLogout();
      Alert.alert('Session expired', 'You have been logged out due to inactivity.');
    }, SESSION_TIMEOUT_MS);
  };

  const handleUserActivity = () => {
    if (!authToken || !userSession) return;
    startSessionTimeout();
  };

  useEffect(() => {
    startSessionTimeout();
    return () => {
      clearSessionTimeout();
    };
  }, [authToken, userSession, currentScreen]);

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    return response;
  };

  const loginUser = async () => {
    if (!email || !password) {
      return Alert.alert('Authentication Alert', 'Please enter your corporate email and secure passphrase.');
    }
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) {
        return Alert.alert('Login failed', data.error || 'Unable to authenticate');
      }
      setAuthToken(data.token);
      setUserSession(data.user);
      setTenantId(data.user.tenant_id || 1);
      setPassword('');
      const nextScreen = {
        Boss: 'BossDashboard',
        Salesperson: 'SalesDashboard',
        Driver: 'Deliveries',
        Manager: 'BossDashboard',
        SuperAdmin: 'AdminDashboard'
      }[data.user.role] || 'BossDashboard';
      setCurrentScreen(nextScreen);
    } catch (error) {
      Alert.alert('Login error', error.message);
    }
  };

  const handleLogin = () => {
    console.log('Login button pressed');
    loginUser();
  };

  const registerUser = async () => {
    if (!registerForm.business_name || !registerForm.subdomain || !registerForm.name || !registerForm.email || !registerForm.password) {
      return Alert.alert('Validation', 'All registration fields are required.');
    }
    if (!allowedRegistrationRoles.includes(registerForm.role)) {
      return Alert.alert('Validation', 'Selected role is not allowed for public registration.');
    }
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await response.json();
      if (!response.ok) {
        return Alert.alert('Registration failed', data.error || 'Unable to register');
      }
      setAuthToken(data.token);
      setUserSession(data.user);
      setTenantId(data.user.tenant_id || 1);
      setRegisterForm({ business_name: '', subdomain: '', name: '', email: '', password: '', role: 'Boss' });
      const nextScreen = getDefaultScreenForRole(data.user.role);
      setCurrentScreen(nextScreen);
    } catch (error) {
      Alert.alert('Registration error', error.message);
    }
  };

  const sendOTP = async () => {
    if (!email) return Alert.alert('Validation', 'Please enter your email to receive OTP.');
    try {
      const response = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) return Alert.alert('OTP error', data.error || 'Could not send OTP');
      Alert.alert('OTP Sent', `OTP code: ${data.otp} (demo)`);
      setCurrentScreen('VerifyOTP');
    } catch (error) {
      Alert.alert('OTP error', error.message);
    }
  };

  const verifyOTP = async () => {
    if (!email || !otpCode) return Alert.alert('Validation', 'Provide email and OTP code.');
    try {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode })
      });
      const data = await response.json();
      if (!response.ok) return Alert.alert('OTP verify failed', data.error || 'Invalid OTP');
      Alert.alert('Verified', 'OTP verified successfully.');
      setOtpCode('');
      setCurrentScreen('Login');
    } catch (error) {
      Alert.alert('OTP error', error.message);
    }
  };

  const forgotPassword = async () => {
    if (!resetEmail) return Alert.alert('Validation', 'Enter the email to reset password.');
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      const data = await response.json();
      if (!response.ok) return Alert.alert('Error', data.error || 'Unable to request password reset');
      Alert.alert('Reset Token', `Token: ${data.reset_token} (demo)`);
      setCurrentScreen('ResetPassword');
    } catch (error) {
      Alert.alert('Reset error', error.message);
    }
  };

  const resetPasswordAction = async () => {
    if (!resetEmail || !resetToken || !newPassword) return Alert.alert('Validation', 'Email, token and new password are required.');
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, reset_token: resetToken, new_password: newPassword })
      });
      const data = await response.json();
      if (!response.ok) return Alert.alert('Error', data.error || 'Unable to reset password');
      Alert.alert('Success', 'Password has been reset. Please log in.');
      setResetEmail('');
      setResetToken('');
      setNewPassword('');
      setCurrentScreen('Login');
    } catch (error) {
      Alert.alert('Reset error', error.message);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/biometric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Biometric', data.message);
      }
    } catch (error) {
      Alert.alert('Biometric error', error.message);
    }
  };

  useEffect(() => {
    if (!userSession) return;
    loadCustomers();
    loadProducts();
    loadSales();
    loadVehicles();
    loadDeliveries();
    loadDebts();
    fetchExpenses();
    loadPayments();
    loadSuppliers();
    loadPurchaseOrders();
    loadAttendance();
    loadUsers();
    loadDashboardSummary();
    if (userSession?.role === 'Boss') loadBossMetrics();
    if (userSession?.role === 'SuperAdmin') {
      loadAdminOverview();
      loadAdminTenants();
      loadAuditLogs();
    }
    loadFinanceSummary();
    loadCustomerDebtReports();
  }, [userSession, tenantId]);

  const renderHeader = (title) => {
    const roleLabel = userSession?.role ? `${userSession.role} Portal` : 'JengaPlus Portal';
    return (
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.welcomeTxt}>{title}</Text>
          <Text style={styles.userNameTitle}>{userSession?.name || 'JengaPlus User'}</Text>
          <Text style={styles.userRoleTag}>{roleLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {userSession?.role === 'SuperAdmin' && (
            <TouchableOpacity style={[styles.logoutBtn, { marginRight: 8 }]} onPress={() => { setCurrentScreen('AdminDashboard'); }}>
              <Text style={[styles.logoutBtnTxt]}>Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const loadAdminOverview = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/overview`);
      if (res.ok) {
        const d = await res.json();
        setAdminOverview(d);
      }
    } catch (e) {
      console.warn('Admin overview load failed', e.message || e);
    }
  };

  const loadAdminTenants = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/tenants`);
      if (res.ok) {
        const data = await res.json();
        setAdminTenants(data);
      }
    } catch (e) {
      console.warn('Failed to load tenants', e.message || e);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.warn('Failed to load audit logs', e.message || e);
    }
  };

  const updateTenantStatus = async (tenantIdValue, status) => {
    setTenantStatusLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/tenants/${tenantIdValue}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_status: status }),
      });
      const data = await res.json();
      if (!res.ok) return Alert.alert('Update failed', data.error || 'Unable to update tenant status');
      Alert.alert('Tenant updated', `${data.tenant.business_name} set to ${status}`);
      await loadAdminTenants();
      await loadAdminOverview();
    } catch (e) {
      Alert.alert('Update failed', e.message || String(e));
    } finally {
      setTenantStatusLoading(false);
    }
  };

  const uploadCsv = async (csvText) => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/import-csv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: tenantId, csvText }) });
      const data = await res.json();
      if (!res.ok) return Alert.alert('Import error', data.error || 'Failed to import');
      Alert.alert('Import result', `Created: ${data.createdCount || 0}, Updated: ${data.updatedCount || 0}, Errors: ${data.errors?.length || 0}`);
      loadProducts();
    } catch (err) {
      Alert.alert('Import error', err.message);
    }
  };

  const pickAndUploadCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.type !== 'success') return Alert.alert('Cancelled', 'No file selected.');
      // read file
      const fileUri = res.uri;
      const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
      if (!content) return Alert.alert('Read error', 'Could not read file contents');
      // set to textarea and upload
      setReportData(content);
      await uploadCsv(content);
    } catch (err) {
      Alert.alert('File error', err.message || String(err));
    }
  };

  const runScheduledRestock = async () => {
    try {
      const res = await authFetch(`${API_BASE}/inventory/schedule-run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return Alert.alert('Run error', data.error || 'Failed to run schedule');
      setSchedulerResult(data.results || data);
      Alert.alert('Scheduled run complete', `Processed ${Array.isArray(data.results) ? data.results.length : 0} tenants`);
    } catch (err) {
      Alert.alert('Run error', err.message);
    }
  };

  return (
    <SafeAreaView
      style={styles.mainContainer}
      onTouchStart={handleUserActivity}
    >
      {initializing ? (
        <View style={styles.startupScreen}>
          <Animatable.View animation="fadeInUp" duration={800} style={styles.startupCard}>
            <Animatable.View animation="pulse" easing="ease-out" iterationCount="infinite" duration={1800} style={styles.startupLogoPulse}>
              <View style={styles.startupLogoFrame}>
                <Animatable.Image
                  animation="zoomIn"
                  duration={1600}
                  delay={240}
                  source={require('./assets/jengaplus_enhanced.png')}
                  style={styles.startupLogo}
                  resizeMode="contain"
                />
              </View>
            </Animatable.View>
            <Animatable.Text animation="fadeInDown" duration={1100} delay={900} style={styles.startupTitle}>
              JENGA PLUS
            </Animatable.Text>
            <Animatable.Text animation="fadeIn" duration={1000} delay={1200} style={styles.startupBadgeText}>
              BUILT FOR BUSINESS
            </Animatable.Text>
            <View style={styles.startupFeatureBadgeCombined}>
              <Text style={styles.startupFeatureText}>🚀 Speed · 📈 Growth · 📊 Control</Text>
            </View>
            <Animatable.View animation="slideInLeft" duration={900} delay={1500} style={styles.startupProgressBar}>
              <View style={[styles.startupProgressFill, { width: '88%' }]} />
            </Animatable.View>
            <Animatable.Text animation="fadeIn" duration={1000} delay={1650} style={styles.startupHint}>
              Loading your workspace, secure tools, and business insights…
            </Animatable.Text>
          </Animatable.View>
        </View>
      ) : (
        currentScreen === 'Login' && (
          <View style={styles.loginScreenWrapper}>
            <View style={styles.loginBackdrop} />
          <View style={styles.loginGradientOverlay} />
          <View style={styles.loginWatermarkContainer} pointerEvents="none">
            <Text style={styles.loginWatermark}>CONSTRUCTION</Text>
          </View>

          <View style={styles.loginCard}>
            
            <Text style={styles.brandTitle}>JENGA PLUS</Text>
            <Text style={styles.brandSubtitle}>Smart Construction & Management</Text>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>📧</Text>
              <TextInput
                style={styles.textInputStyle}
                placeholder="boss@marcomaterials.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>🔒</Text>
              <TextInput
                style={styles.textInputStyle}
                placeholder="Secure passphrase"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.7}
              onPress={() => {
                console.log('Login button pressed');
                handleLogin();
              }}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.linkButton, { marginTop: 14 }]} onPress={() => setCurrentScreen('Register')}>
              <Text style={styles.linkButtonText}>Register New Business</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={() => setCurrentScreen('ForgotPassword')}>
              <Text style={styles.linkButtonText}>Forgot Password</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={handleBiometricLogin}>
              <Text style={styles.linkButtonText}>Biometric Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))} 

      {currentScreen === 'Register' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Register Business')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Business Name</Text>
            <TextInput
              style={styles.textInputStyle}
              value={registerForm.business_name}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, business_name: value }))}
              placeholder="Business name"
            />
            <Text style={styles.inputLabel}>Subdomain</Text>
            <TextInput
              style={styles.textInputStyle}
              value={registerForm.subdomain}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, subdomain: value }))}
              placeholder="subdomain"
            />
            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput
              style={styles.textInputStyle}
              value={registerForm.name}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, name: value }))}
              placeholder="Owner name"
            />
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInputStyle}
              value={registerForm.email}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, email: value }))}
              autoCapitalize="none"
              placeholder="Email"
            />
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.textInputStyle}
              value={registerForm.password}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
              secureTextEntry
              placeholder="Password"
            />
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={registerForm.role}
                onValueChange={(value) => setRegisterForm((prev) => ({ ...prev, role: value }))}
                mode="dropdown"
                style={styles.pickerStyle}
              >
                {allowedRegistrationRoles.map((role) => (
                  <Picker.Item key={role} label={role} value={role} />
                ))}
              </Picker>
            </View>
            <TouchableOpacity style={styles.primaryActionButton} onPress={registerUser}>
              <Text style={styles.actionBtnTextText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Login')}>
              <Text style={styles.secondaryActionText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'ForgotPassword' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Password Reset')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInputStyle}
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              placeholder="Email"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={forgotPassword}>
              <Text style={styles.actionBtnTextText}>Send Reset Token</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Login')}>
              <Text style={styles.secondaryActionText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'ResetPassword' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Complete Password Reset')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInputStyle}
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              placeholder="Email"
            />
            <Text style={styles.inputLabel}>Reset Token</Text>
            <TextInput
              style={styles.textInputStyle}
              value={resetToken}
              onChangeText={setResetToken}
              placeholder="Token"
            />
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.textInputStyle}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New password"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={resetPasswordAction}>
              <Text style={styles.actionBtnTextText}>Reset Password</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Login')}>
              <Text style={styles.secondaryActionText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'VerifyOTP' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Verify OTP')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInputStyle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholder="Email"
            />
            <Text style={styles.inputLabel}>OTP Code</Text>
            <TextInput
              style={styles.textInputStyle}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="numeric"
              placeholder="Enter OTP"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={verifyOTP}>
              <Text style={styles.actionBtnTextText}>Verify OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Login')}>
              <Text style={styles.secondaryActionText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'BossDashboard' && userSession && (
        <ScrollView style={[styles.dashboardContainer, dashboardThemeStyle]}>
          {renderHeader(dashboardTitle)}

          <View style={styles.premiumBanner}>
            <Text style={styles.premiumBannerTitle}>Classic Executive Dashboard</Text>
            <Text style={styles.premiumBannerText}>Premium insights, clean metrics and quick role-based workflows for your leadership role.</Text>
            {growthReport && growthReport.percent_change > 5 && (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10 }}>
                <Text style={{ color: '#10B981', fontWeight: '800' }}>Congratulations — revenue up {Math.round(growthReport.percent_change)}% vs last month!</Text>
              </View>
            )}
          </View>

          <Text style={styles.enterpriseTitleSection}>{userSession.tenant_name || userSession.tenant || 'Tenant'} Performance Matrix</Text>
          <View style={styles.bossStatsGrid}>
            <View style={[styles.statsCard, { borderLeftColor: '#10B981' }]}>
              <Text style={styles.statsLabel}>Total Consolidated Revenue</Text>
              <Text style={[styles.statsValue, { color: '#10B981' }]}>TZS 42,850,000</Text>
            </View>
            <View style={[styles.statsCard, { borderLeftColor: '#EF4444' }]}>
              <Text style={styles.statsLabel}>Operating Expenses Output</Text>
              <Text style={[styles.statsValue, { color: '#EF4444' }]}>TZS 18,400,000</Text>
            </View>
            <View style={[styles.statsCard, { borderLeftColor: '#2563EB' }]}>
              <Text style={styles.statsLabel}>Net Profit Margin</Text>
              <Text style={[styles.statsValue, { color: '#2563EB' }]}>TZS 24,450,000</Text>
            </View>
            <View style={[styles.statsCard, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.statsLabel}>Critical Stock Alerts</Text>
              <Text style={[styles.statsValue, { color: '#F59E0B' }]}>4 Materials Low</Text>
            </View>
          </View>

          <Text style={styles.sectionDividerHeader}>Sales Overview</Text>
          <View style={{ paddingVertical: 8 }}>
            {bossSalesSummary ? (
              <View>
                <BarChart
                  data={{ labels: ['Daily','Weekly','Monthly'], datasets: [{ data: [bossSalesSummary.daily || 0, bossSalesSummary.weekly || 0, bossSalesSummary.monthly || 0] }] }}
                  width={Dimensions.get('window').width - 48}
                  height={220}
                  yAxisLabel="TZS "
                  chartConfig={{ backgroundGradientFrom: '#020814', backgroundGradientTo: '#020814', color: (opacity=1) => `rgba(37,99,235,${opacity})`, labelColor: (opacity=1)=>`rgba(148,163,184,${opacity})` }}
                />
                <Text style={[styles.sectionDividerHeader, { marginTop: 12 }]}>Sales Composition</Text>
                <PieChart
                  data={[{ name: 'Cash', population: 60, color: '#10B981' }, { name: 'Credit', population: 40, color: '#2563EB' }]}
                  width={Dimensions.get('window').width - 48}
                  height={160}
                  chartConfig={{ color: (opacity=1)=>`rgba(148,163,184,${opacity})` }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                />
              </View>
            ) : (
              <Text style={styles.inputLabel}>Loading metrics...</Text>
            )}
          </View>

          <Text style={styles.sectionDividerHeader}>Registered Team Members 👥</Text>
          <View style={{ marginBottom: 16 }}>
            {users && users.length > 0 ? (
              <View>
                {users.map((user) => (
                  <View key={user.id} style={[styles.cardRow, { marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 4, borderLeftColor: user.role === 'Boss' ? '#F59E0B' : user.role === 'Driver' ? '#3B82F6' : '#10B981' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statsLabel, { fontSize: 15, fontWeight: '700' }]}>{user.name}</Text>
                      <Text style={[styles.cardSubtitle, { fontSize: 12, marginTop: 2 }]}>{user.role} • {user.email}</Text>
                      {user.phone && <Text style={[styles.cardSubtitle, { fontSize: 11, marginTop: 2 }]}>📱 {user.phone}</Text>}
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: user.role === 'Boss' ? 'rgba(245,158,11,0.15)' : user.role === 'Driver' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', borderRadius: 6 }}>
                      <Text style={{ color: user.role === 'Boss' ? '#F59E0B' : user.role === 'Driver' ? '#3B82F6' : '#10B981', fontSize: 11, fontWeight: '700' }}>{user.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardSubtitle}>No team members registered yet</Text>
            )}
            <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 12 }]} onPress={() => { loadUsers(); setCurrentScreen('Users'); }}>
              <Text style={styles.actionBtnTextText}>Manage Team</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            <VoiceAssistant onCommand={(cmd)=>Alert.alert('Voice', `Command: ${cmd}`)} />
            <View style={{ height: 12 }} />
            <Badges badges={[{title:'Top Seller - Bronze'},{title:'On-time Delivery'}]} />
          </View>

          <Text style={styles.sectionDividerHeader}>Management Shortcuts</Text>
          <View style={styles.shortcutGrid}>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadCustomers(); setCurrentScreen('Customers'); }}>
              <Text style={styles.shortcutBtnItemText}>Customer CRM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { fetchExpenses(); setCurrentScreen('Expenses'); }}>
              <Text style={styles.shortcutBtnItemText}>Expense Ledger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadDashboardSummary(); setCurrentScreen('DashboardSummary'); }}>
              <Text style={styles.shortcutBtnItemText}>Business Summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadProducts(); loadSales(); setCurrentScreen('SalesDashboard'); }}>
              <Text style={styles.shortcutBtnItemText}>Sales / POS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadProducts(); setCurrentScreen('Products'); }}>
              <Text style={styles.shortcutBtnItemText}>Inventory Catalog</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadSuppliers(); setCurrentScreen('Suppliers'); }}>
              <Text style={styles.shortcutBtnItemText}>Suppliers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { setCurrentScreen('BulkImport'); }}>
              <Text style={styles.shortcutBtnItemText}>Bulk Import</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadPurchaseOrders(); setCurrentScreen('PurchaseOrders'); }}>
              <Text style={styles.shortcutBtnItemText}>Purchase Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadUsers(); setCurrentScreen('Users'); }}>
              <Text style={styles.shortcutBtnItemText}>Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadAttendance(); setCurrentScreen('Attendance'); }}>
              <Text style={styles.shortcutBtnItemText}>Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadDebts(); setCurrentScreen('CustomerDebts'); }}>
              <Text style={styles.shortcutBtnItemText}>Debt Ledger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadPayments(); setCurrentScreen('Payments'); }}>
              <Text style={styles.shortcutBtnItemText}>Payments</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { calculatePaymentSummary(); setCurrentScreen('PaymentSummary'); }}>
              <Text style={styles.shortcutBtnItemText}>Payment Summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadCustomerAgingReport(); setCurrentScreen('CustomerAging'); }}>
              <Text style={styles.shortcutBtnItemText}>Aging Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadVehicles(); setCurrentScreen('Vehicles'); }}>
              <Text style={styles.shortcutBtnItemText}>Fleet Management</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadDeliveries(); setCurrentScreen('Deliveries'); }}>
              <Text style={styles.shortcutBtnItemText}>Delivery Tracking</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadFinanceSummary(); setCurrentScreen('FinanceSummary'); }}>
              <Text style={styles.shortcutBtnItemText}>Financial Summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutBtnItem} onPress={() => { loadCustomerDebtReports(); setCurrentScreen('Reports'); }}>
              <Text style={styles.shortcutBtnItemText}>Reports</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'BulkImport' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Bulk Inventory Import')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Paste CSV content (header: category,name,unit,price,cost_price,stock_quantity,low_stock_threshold)</Text>
            <TextInput
              style={[styles.textInputStyle, { height: 160, textAlignVertical: 'top' }]}
              multiline
              placeholder="category,name,unit,price,cost_price,stock_quantity,low_stock_threshold\nCement,Dangote 50kg,Bag,18000,14000,100,10"
              onChangeText={(v) => setReportData(v)}
              value={reportData}
            />
            <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 12 }]} onPress={pickAndUploadCsv}>
              <Text style={styles.actionBtnTextText}>Pick CSV File</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryActionButton} onPress={() => uploadCsv(reportData)}>
              <Text style={styles.actionBtnTextText}>Import CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
              <Text style={styles.secondaryActionText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'AdminDashboard' && userSession && userSession.role === 'SuperAdmin' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('SuperAdmin Console')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Platform Overview</Text>
            {adminOverview ? (
              <View>
                <Text style={styles.statsLabel}>Tenants: {adminOverview.tenants}</Text>
                <Text style={styles.statsLabel}>Users: {adminOverview.users}</Text>
                <Text style={styles.statsLabel}>Products: {adminOverview.products}</Text>
                <Text style={styles.statsLabel}>Low Stock Items: {adminOverview.low_stock}</Text>
                <Text style={styles.statsLabel}>Suspended Tenants: {adminOverview.suspended_tenants}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 10 }}>
                  <TouchableOpacity style={[styles.primaryActionButton, { flex: 1, minWidth: 140 }]} onPress={async () => { await loadAdminOverview(); await loadAdminTenants(); await loadAuditLogs(); }}>
                    <Text style={styles.actionBtnTextText}>Refresh Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryActionButton, { flex: 1, minWidth: 140 }]} onPress={runScheduledRestock}>
                    <Text style={styles.actionBtnTextText}>Run Restock</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.formContainer, { marginTop: 14, backgroundColor: 'rgba(59,130,246,0.05)' }]}> 
                  <Text style={styles.inputLabel}>Platform Health</Text>
                  <Text style={styles.cardSubtitle}>Suspended tenants: {adminTenants.filter((t) => t.subscription_status === 'Suspended').length}</Text>
                  <Text style={styles.cardSubtitle}>Audit entries loaded: {auditLogs.length}</Text>
                  <Text style={styles.cardSubtitle}>Latest refresh: {new Date().toLocaleTimeString()}</Text>
                </View>
                <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 12 }]} onPress={() => setCurrentScreen('TenantManagement')}>
                  <Text style={styles.actionBtnTextText}>Manage Tenants</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 12 }]} onPress={() => setCurrentScreen('CreateTenant')}>
                  <Text style={styles.secondaryActionText}>Create Tenant</Text>
                </TouchableOpacity>
                {schedulerResult && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.inputLabel}>Last run results:</Text>
                    <Text style={{ color: '#CBD5E1' }}>{JSON.stringify(schedulerResult, null, 2)}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.inputLabel}>Loading overview...</Text>
            )}
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Tenant Management</Text>
            {adminTenants.length > 0 ? adminTenants.map((tenant) => (
              <View key={tenant.id} style={[styles.cardRow, { alignItems: 'center', justifyContent: 'space-between' }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.statsLabel}>{tenant.business_name}</Text>
                  <Text style={styles.cardSubtitle}>{tenant.subdomain} • {tenant.subscription_status}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {['Active', 'Suspended', 'Inactive'].map((status) => (
                    <TouchableOpacity
                      key={`${tenant.id}-${status}`}
                      style={[styles.inlineButton, { backgroundColor: status === 'Active' ? '#10B981' : status === 'Suspended' ? '#F59E0B' : '#6B7280', marginBottom: 6, marginRight: 6 }]}
                      disabled={tenantStatusLoading || tenant.subscription_status === status}
                      onPress={() => updateTenantStatus(tenant.id, status)}
                    >
                      <Text style={styles.inlineButtonText}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )) : (
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>No tenants available.</Text>
            )}
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Audit Trail</Text>
            {auditLogs.length > 0 ? auditLogs.slice(0, 25).map((log) => (
              <View key={log.id} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>{log.action.replace(/_/g, ' ')}</Text>
                  <Text style={styles.cardSubtitle}>{log.entity} • {log.details ? JSON.stringify(log.details) : 'No details'}</Text>
                  <Text style={[styles.cardSubtitle, { fontSize: 12 }]}>{new Date(log.created_at).toLocaleString()} by {log.user_name || log.user_email || 'System'}</Text>
                </View>
              </View>
            )) : (
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Loading audit logs...</Text>
            )}
          </View>

          <TouchableOpacity style={styles.secondaryActionButton} onPress={handleLogout}>
            <Text style={styles.secondaryActionText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'TenantManagement' && userSession && userSession.role === 'SuperAdmin' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Tenant Management')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Tenants</Text>
            {adminTenants.length > 0 ? adminTenants.map((tenant) => (
              <View key={tenant.id} style={[styles.cardRow, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.statsLabel}>{tenant.business_name}</Text>
                  <Text style={styles.cardSubtitle}>{tenant.subdomain} • {tenant.subscription_status}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#2563EB', marginRight: 6 }]} onPress={() => { setSelectedTenant(tenant); setCurrentScreen('TenantDetails'); }}>
                    <Text style={styles.inlineButtonText}>Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#10B981' }]} onPress={() => updateTenantStatus(tenant.id, 'Active')}>
                    <Text style={styles.inlineButtonText}>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#F59E0B', marginLeft: 6 }]} onPress={() => updateTenantStatus(tenant.id, 'Suspended')}>
                    <Text style={styles.inlineButtonText}>Suspend</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )) : (
              <Text style={styles.inputLabel}>Loading tenants or none available.</Text>
            )}
            <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 12 }]} onPress={() => setCurrentScreen('CreateTenant')}>
              <Text style={styles.actionBtnTextText}>Create New Tenant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('AdminDashboard')}>
              <Text style={styles.secondaryActionText}>Back to SuperAdmin Console</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'CreateTenant' && userSession && userSession.role === 'SuperAdmin' && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Create Tenant')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Business Name</Text>
            <TextInput
              style={styles.textInputStyle}
              value={tenantForm.business_name}
              onChangeText={(value) => setTenantForm((prev) => ({ ...prev, business_name: value }))}
              placeholder="Business name"
            />
            <Text style={styles.inputLabel}>Subdomain</Text>
            <TextInput
              style={styles.textInputStyle}
              value={tenantForm.subdomain}
              onChangeText={(value) => setTenantForm((prev) => ({ ...prev, subdomain: value }))}
              placeholder="subdomain"
            />
            <Text style={styles.inputLabel}>Subscription Status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={tenantForm.subscription_status}
                onValueChange={(value) => setTenantForm((prev) => ({ ...prev, subscription_status: value }))}
                mode="dropdown"
                style={styles.pickerStyle}
              >
                <Picker.Item label="Active" value="Active" />
                <Picker.Item label="Suspended" value="Suspended" />
                <Picker.Item label="Inactive" value="Inactive" />
              </Picker>
            </View>
            <TouchableOpacity style={styles.primaryActionButton} onPress={async () => {
              if (!tenantForm.business_name || !tenantForm.subdomain) {
                return Alert.alert('Validation', 'Business name and subdomain are required.');
              }
              try {
                const res = await authFetch(`${API_BASE}/tenants`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(tenantForm),
                });
                const data = await res.json();
                if (!res.ok) return Alert.alert('Create failed', data.error || 'Unable to create tenant');
                Alert.alert('Tenant created', `Tenant ${data.tenant.business_name} created successfully.`);
                setTenantForm({ business_name: '', subdomain: '', subscription_status: 'Active' });
                await loadAdminTenants();
                await loadAdminOverview();
                setCurrentScreen('TenantManagement');
              } catch (e) {
                Alert.alert('Create failed', e.message || String(e));
              }
            }}>
              <Text style={styles.actionBtnTextText}>Create Tenant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('TenantManagement')}>
              <Text style={styles.secondaryActionText}>Back to Tenants</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'TenantDetails' && userSession && userSession.role === 'SuperAdmin' && selectedTenant && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Tenant Details')}
          <View style={styles.formContainer}>
            <Text style={styles.statsLabel}>{selectedTenant.business_name}</Text>
            <Text style={styles.cardSubtitle}>Subdomain: {selectedTenant.subdomain}</Text>
            <Text style={styles.cardSubtitle}>Status: {selectedTenant.subscription_status}</Text>
            <Text style={styles.cardSubtitle}>Created: {new Date(selectedTenant.created_at).toLocaleString()}</Text>
            <View style={{ marginTop: 16 }}>
              <Text style={styles.inputLabel}>Actions</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {['Active', 'Suspended', 'Inactive'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.inlineButton, { backgroundColor: status === 'Active' ? '#10B981' : status === 'Suspended' ? '#F59E0B' : '#6B7280', marginRight: 6, marginBottom: 6 }]}
                    onPress={() => updateTenantStatus(selectedTenant.id, status)}
                    disabled={tenantStatusLoading || selectedTenant.subscription_status === status}
                  >
                    <Text style={styles.inlineButtonText}>{status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('TenantManagement')}>
              <Text style={styles.secondaryActionText}>Back to Tenant List</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Users' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Team Management')}
          <View style={[styles.formContainer, { marginBottom: 18 }]}> 
            <Text style={[styles.statsLabel, { marginBottom: 10 }]}>Add / Edit Team Member</Text>
            {['name', 'email', 'password', 'role'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={userForm[field]}
                  onChangeText={(value) => setUserForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                  secureTextEntry={field === 'password'}
                  autoCapitalize={field === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveUser}>
              <Text style={styles.actionBtnTextText}>Save Team Member</Text>
            </TouchableOpacity>
          </View>
          {users.map((user) => (
            <View key={user.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{user.name}</Text>
                <Text style={styles.cardSubtitle}>{user.email} • {user.role}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8, backgroundColor: '#F59E0B' }]} onPress={() => loadUserForEdit(user)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deleteUser(user)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'EditUser' && userSession && selectedUserRecord && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Team Member')}
          <View style={styles.formContainer}>
            {['name', 'email', 'password', 'role'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={userForm[field]}
                  onChangeText={(value) => setUserForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                  secureTextEntry={field === 'password'}
                  autoCapitalize={field === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateUser}>
              <Text style={styles.actionBtnTextText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Users')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Customers' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Customer Management')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('AddCustomer'); setSelectedCustomer(null); }}>
            <Text style={styles.secondaryActionText}>+ Add New Customer</Text>
          </TouchableOpacity>
          {customers.map((customer) => (
            <View key={customer.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{customer.name}</Text>
                <Text style={styles.cardSubtitle}>{customer.category} • {customer.phone || 'No phone'} • Bal: TZS {customer.outstanding_balance}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => { setSelectedCustomer(customer); setCurrentScreen('RecordDebt'); }}>
                  <Text style={styles.inlineButtonText}>Record Debt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8, backgroundColor: '#F59E0B' }]} onPress={() => loadCustomerForEdit(customer)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => removeCustomer(customer)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddCustomer' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Add Customer')}
          <View style={styles.formContainer}>
            {['name', 'phone', 'address', 'category', 'credit_limit', 'loyalty_tier'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={customerForm[field]}
                  onChangeText={(value) => setCustomerForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveCustomer}>
              <Text style={styles.actionBtnTextText}>Create Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Customers')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditCustomer' && userSession && selectedCustomer && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Customer')}
          <View style={styles.formContainer}>
            {['name', 'phone', 'address', 'category', 'credit_limit', 'loyalty_tier'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={customerForm[field]}
                  onChangeText={(value) => setCustomerForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateCustomer}>
              <Text style={styles.actionBtnTextText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Customers')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'RecordDebt' && userSession && selectedCustomer && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Record Customer Debt')}
          <View style={styles.formContainer}>
            <Text style={styles.statsLabel}>Customer</Text>
            <Text style={styles.statsValue}>{selectedCustomer.name}</Text>
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={debtAmount}
              onChangeText={setDebtAmount}
              placeholder="Enter debt amount"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Due Date</Text>
            <TextInput
              style={styles.textInputStyle}
              value={debtDueDate}
              onChangeText={setDebtDueDate}
              placeholder="YYYY-MM-DD"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={() => recordDebt(selectedCustomer)}>
              <Text style={styles.actionBtnTextText}>Save Debt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Customers')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Expenses' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Expense Management')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('AddExpense'); setExpenseForm({ category: '', vendor: '', amount: '0', currency: 'TZS', payment_method: 'Cash', expense_date: '', description: '' }); }}>
            <Text style={styles.secondaryActionText}>+ Log New Expense</Text>
          </TouchableOpacity>
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{expense.category} - {expense.vendor || 'Vendor not set'}</Text>
                <Text style={styles.cardSubtitle}>{expense.currency} {expense.amount} • {expense.payment_method} • {expense.expense_date}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8, backgroundColor: '#F59E0B' }]} onPress={() => loadExpenseForEdit(expense)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deleteExpense(expense)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddExpense' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Log Expense')}
          <View style={styles.formContainer}>
            {['category', 'vendor', 'amount', 'currency', 'payment_method', 'expense_date', 'description'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={expenseForm[field]}
                  onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveExpense}>
              <Text style={styles.actionBtnTextText}>Record Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Expenses')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditExpense' && userSession && selectedExpense && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Expense')}
          <View style={styles.formContainer}>
            {['category', 'vendor', 'amount', 'currency', 'payment_method', 'expense_date', 'description'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={expenseForm[field]}
                  onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateExpense}>
              <Text style={styles.actionBtnTextText}>Save Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Expenses')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'FinanceSummary' && userSession && (
        <ScrollView style={[styles.dashboardContainer, styles.glassScreenBackground]}>
          {renderHeader('Finance Summary')}
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Total Revenue</Text>
            <Text style={[styles.statsValue, { color: '#60A5FA' }]}>TZS {financeSummary?.total_revenue ?? '0.00'}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardGold, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Total Expenses</Text>
            <Text style={[styles.statsValue, { color: '#FBBF24' }]}>TZS {financeSummary?.total_expenses ?? '0.00'}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Profit / Loss</Text>
            <Text style={[styles.statsValue, { color: financeSummary?.profit_loss >= 0 ? '#34D399' : '#F87171' }]}>TZS {financeSummary?.profit_loss ?? '0.00'}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Outstanding Customer Balance</Text>
            <Text style={[styles.statsValue, { color: '#E2E8F0' }]}>TZS {financeSummary?.total_outstanding ?? '0.00'}</Text>
          </View>
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Return to Boss Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'Reports' && userSession && reportData && (
        <ScrollView style={[styles.dashboardContainer, styles.glassScreenBackground]}>
          {renderHeader('Reports & Charts')}
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 12, width: '100%' }]}> 
            <Text style={styles.statsLabel}>Revenue vs Expenses</Text>
            <LineChart
              data={{
                labels: ['Revenue', 'Expenses', 'Outstanding'],
                datasets: [{ data: [reportData.revenue, reportData.expenses, reportData.outstanding] }]
              }}
              width={Dimensions.get('window').width - 64}
              height={220}
              yAxisLabel="TZS "
              chartConfig={{
                backgroundGradientFrom: '#071426',
                backgroundGradientTo: '#102444',
                color: () => '#60A5FA',
                labelColor: () => '#94A3B8',
                style: { borderRadius: 20 }
              }}
              bezier
              style={{ marginVertical: 12, borderRadius: 20 }}
            />
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 12, width: '100%' }]}> 
            <Text style={styles.statsLabel}>Sales Composition</Text>
            <BarChart
              data={{
                labels: ['Sales'],
                datasets: [{ data: [reportData.total_sales] }]
              }}
              width={Dimensions.get('window').width - 64}
              height={180}
              chartConfig={{
                backgroundGradientFrom: '#071426',
                backgroundGradientTo: '#102444',
                color: () => '#F59E0B',
                labelColor: () => '#94A3B8',
                style: { borderRadius: 20 }
              }}
              style={{ marginVertical: 12, borderRadius: 20 }}
            />
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 12, width: '100%' }]}> 
            <Text style={styles.statsLabel}>Business Composition</Text>
            <PieChart
              data={[
                { name: 'Revenue', population: reportData.revenue, color: '#60A5FA', legendFontColor: '#CBD5E1', legendFontSize: 12 },
                { name: 'Expenses', population: reportData.expenses, color: '#F59E0B', legendFontColor: '#CBD5E1', legendFontSize: 12 },
                { name: 'Outstanding', population: reportData.outstanding, color: '#34D399', legendFontColor: '#CBD5E1', legendFontSize: 12 }
              ]}
              width={Dimensions.get('window').width - 64}
              height={180}
              chartConfig={{
                backgroundGradientFrom: '#071426',
                backgroundGradientTo: '#102444',
                color: () => '#CBD5E1',
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { width: '100%', marginTop: 10 }]}> 
            <Text style={styles.statsLabel}>Revenue</Text>
            <Text style={styles.statsValue}>TZS {(reportData.revenue || 0).toFixed(2)}</Text>
            <Text style={styles.statsLabel}>Expenses</Text>
            <Text style={styles.statsValue}>TZS {(reportData.expenses || 0).toFixed(2)}</Text>
            <Text style={styles.statsLabel}>Outstanding</Text>
            <Text style={styles.statsValue}>TZS {(reportData.outstanding || 0).toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'DashboardSummary' && userSession && (
        <ScrollView style={[styles.dashboardContainer, styles.glassScreenBackground]}>
          {renderHeader('Business Summary')}
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Customers</Text>
            <Text style={[styles.statsValue, { color: '#60A5FA' }]}>{dashboardSummary?.total_customers ?? 0}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardGold, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Sales Orders</Text>
            <Text style={[styles.statsValue, { color: '#FBBF24' }]}>{dashboardSummary?.total_sales ?? 0}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Deliveries</Text>
            <Text style={[styles.statsValue, { color: '#34D399' }]}>{dashboardSummary?.total_deliveries ?? 0}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Vehicles</Text>
            <Text style={[styles.statsValue, { color: '#E2E8F0' }]}>{dashboardSummary?.total_vehicles ?? 0}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardGold, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Low Stock Alerts</Text>
            <Text style={[styles.statsValue, { color: '#F87171' }]}>{dashboardSummary?.low_stock_count ?? 0}</Text>
          </View>
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'SalesDashboard' && userSession && (
        <ScrollView style={[styles.dashboardContainer, styles.sellerDashboardContainer]}>
          {renderHeader('Sales Hub')}
          <View style={styles.sellerBanner}>
            <Text style={styles.sellerBannerText}>Fast access to sales, inventory and POS workflows designed for your daily operations.</Text>
          </View>
          <View style={[styles.formContainer, { marginBottom: 12, backgroundColor: 'rgba(59,130,246,0.05)' }]}> 
            <Text style={styles.inputLabel}>Sales Sprint</Text>
            <Text style={styles.cardSubtitle}>Open orders: {sales?.filter((sale) => sale.payment_status !== 'Paid').length ?? 0}</Text>
            <Text style={styles.cardSubtitle}>Outstanding customer debts: {customerDebts?.length ?? 0}</Text>
          </View>

          <Text style={styles.sectionDividerHeader}>Your Team 👫</Text>
          <View style={{ marginBottom: 16 }}>
            {users && users.length > 0 ? (
              <View>
                {users.filter(u => u.role !== 'Driver').map((user) => (
                  <View key={user.id} style={[styles.cardRow, { marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: user.role === 'Boss' ? '#F59E0B' : '#10B981' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statsLabel, { fontSize: 14, fontWeight: '700' }]}>{user.name}</Text>
                      <Text style={[styles.cardSubtitle, { fontSize: 11, marginTop: 2 }]}>{user.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardSubtitle}>No team members available</Text>
            )}
          </View>

          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('NewSale')}>
            <Text style={styles.secondaryActionText}>+ Create New Sale</Text>
          </TouchableOpacity>
          {sales.map((sale) => (
            <View key={sale.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{sale.invoice_number || `Sale ${sale.id}`}</Text>
                <Text style={styles.cardSubtitle}>{sale.customer_name || 'Walk-in'} • TZS {sale.total_amount}</Text>
              </View>
              <TouchableOpacity style={styles.inlineButton} onPress={() => loadSaleDetails(sale.id)}>
                <Text style={styles.inlineButtonText}>Invoice</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Boss Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'NewSale' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Create POS Sale')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Select Product</Text>
            {products.map((product) => (
              <TouchableOpacity key={product.id} style={styles.cardRow} onPress={() => selectProduct(product)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>{product.name}</Text>
                  <Text style={styles.cardSubtitle}>{product.category} • TZS {product.price} • Stock: {product.stock_quantity}</Text>
                </View>
                <Text style={styles.inlineButtonText}>{productSelection?.id === product.id ? 'Selected' : 'Choose'}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.inputLabel}>Customer Name</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.customer_name}
              onChangeText={(value) => updateSaleTotals('customer_name', value)}
              placeholder="Enter customer name"
            />
            <Text style={styles.inputLabel}>Invoice Number</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.invoice_number}
              onChangeText={(value) => setSaleForm((prev) => ({ ...prev, invoice_number: value }))}
              placeholder="Invoice reference"
            />
            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.quantity}
              onChangeText={(value) => updateSaleTotals('quantity', value)}
              placeholder="Enter quantity"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Unit Price</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.unit_price}
              onChangeText={(value) => updateSaleTotals('unit_price', value)}
              placeholder="Unit price"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Discount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.discount_amount}
              onChangeText={(value) => updateSaleTotals('discount_amount', value)}
              placeholder="Discount amount"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Tax</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.tax_amount}
              onChangeText={(value) => updateSaleTotals('tax_amount', value)}
              placeholder="Tax amount"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Total Amount</Text>
            <Text style={[styles.statsValue, { marginBottom: 12 }]}>TZS {saleForm.total_amount}</Text>
            <Text style={styles.inputLabel}>Payment Method</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.payment_method}
              onChangeText={(value) => setSaleForm((prev) => ({ ...prev, payment_method: value }))}
              placeholder="Cash or Mobile Money"
            />
            <Text style={styles.inputLabel}>Payment Status</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.payment_status}
              onChangeText={(value) => setSaleForm((prev) => ({ ...prev, payment_status: value }))}
              placeholder="Paid or Unpaid"
            />
            <Text style={styles.inputLabel}>Due Date</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.due_date}
              onChangeText={(value) => setSaleForm((prev) => ({ ...prev, due_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.textInputStyle}
              value={saleForm.notes}
              onChangeText={(value) => setSaleForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Sale notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveSale}>
              <Text style={styles.actionBtnTextText}>Record Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('SalesDashboard')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}


      {currentScreen === 'SaleReceipt' && userSession && selectedSale && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Invoice Preview')}
          <View style={styles.formContainer}>
            <Text style={styles.statsLabel}>Invoice: {selectedSale.invoice_number}</Text>
            <Text style={styles.cardSubtitle}>Customer: {selectedSale.customer_name || 'Walk-in'}</Text>
            <Text style={styles.cardSubtitle}>Payment: {selectedSale.payment_method} • {selectedSale.payment_status}</Text>
            <Text style={styles.cardSubtitle}>Date: {new Date(selectedSale.created_at).toLocaleDateString()}</Text>
            <View style={[styles.cardRow, { marginTop: 12 }]}> 
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>Line Items</Text>
              </View>
            </View>
            {(selectedSale.line_items || []).map((item) => (
              <View key={item.id} style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>Product ID {item.product_id || 'N/A'}</Text>
                  <Text style={styles.cardSubtitle}>{item.quantity} x TZS {item.unit_price} - Discount {item.discount}</Text>
                </View>
                <Text style={styles.statsValue}>TZS {item.line_total}</Text>
              </View>
            ))}
            <View style={[styles.statsCard, { width: '100%', marginTop: 12 }]}> 
              <Text style={styles.statsLabel}>Subtotal</Text>
              <Text style={styles.statsValue}>TZS {selectedSale.total_amount}</Text>
            </View>
            <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('SalesDashboard')}>
              <Text style={styles.actionBtnTextText}>Back to Sales</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Products' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Inventory Catalog')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('AddProduct'); setProductForm({ category: '', name: '', unit: '', price: '0', stock_quantity: '0', low_stock_threshold: '10' }); }}>
            <Text style={styles.secondaryActionText}>+ Add Product</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 12 }]} onPress={() => { setScanResult(null); setCurrentScreen('ScanBarcode'); }}>
            <Text style={styles.secondaryActionText}>Scan Barcode</Text>
          </TouchableOpacity>
          {products.map((product) => (
            <View key={product.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{product.name}</Text>
                <Text style={styles.cardSubtitle}>{product.category} • {product.unit} • TZS {product.price} • Stock: {product.stock_quantity}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddProduct' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Add Product')}
          <View style={styles.formContainer}>
            {['category', 'name', 'unit', 'price', 'stock_quantity', 'low_stock_threshold'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={productForm[field]}
                  onChangeText={(value) => setProductForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveProduct}>
              <Text style={styles.actionBtnTextText}>Save Product</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Products')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'ScanBarcode' && userSession && (
        <View style={styles.dashboardContainer}>
          {renderHeader('Barcode Scanner')}
          {!cameraPermission ? (
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Checking camera permissions...</Text>
            </View>
          ) : !cameraPermission.granted ? (
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Camera access is required for barcode scanning.</Text>
              <TouchableOpacity style={styles.primaryActionButton} onPress={requestCameraPermission}>
                <Text style={styles.actionBtnTextText}>Enable Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Products')}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, width: '100%' }}>
              <CameraView
                style={styles.cameraPreview}
                facing={cameraFacing}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128', 'code39', 'upc_a', 'upc_e', 'itf14', 'datamatrix'] }}
              />
              <View style={{ marginTop: 14 }}>
                <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'))}>
                  <Text style={styles.actionBtnTextText}>Flip Camera</Text>
                </TouchableOpacity>
                {scanResult && (
                  <View style={[styles.formContainer, { marginTop: 16 }]}> 
                    <Text style={styles.inputLabel}>Last scan result</Text>
                    <Text style={styles.statsValue}>{scanResult.data}</Text>
                    <Text style={styles.cardSubtitle}>Type: {scanResult.type}</Text>
                    <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 12 }]} onPress={() => setScanResult(null)}>
                      <Text style={styles.secondaryActionText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 14 }]} onPress={() => setCurrentScreen('Products')}>
                  <Text style={styles.secondaryActionText}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {currentScreen === 'CustomerDebts' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Customer Debt Ledger')}
          {customerDebts.map((debt) => (
            <View key={debt.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{debt.customer_name || 'Unknown'} • TZS {debt.amount}</Text>
                <Text style={styles.cardSubtitle}>{debt.sale_reference || 'No reference'} • Due {debt.due_date || 'N/A'}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => loadDebtForEdit(debt)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8, backgroundColor: '#10B981' }]} onPress={() => { setPaymentForm((prev) => ({ ...prev, customer_id: debt.customer_id?.toString() || '', debt_id: debt.id.toString() || '', amount: '0', payment_method: 'Cash', notes: '' })); setCurrentScreen('NewPayment'); }}>
                  <Text style={styles.inlineButtonText}>Pay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8, backgroundColor: '#F59E0B' }]} onPress={() => loadCustomerLedger(debt.customer_id)}>
                  <Text style={styles.inlineButtonText}>Ledger</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deleteDebt(debt)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 16 }]} onPress={() => { loadPayments(); setCurrentScreen('Payments'); }}>
            <Text style={styles.secondaryActionText}>View Payments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'EditDebt' && userSession && selectedDebt && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Debt Record')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Customer</Text>
            <Text style={styles.statsValue}>{selectedDebt.customer_name || 'Unknown'}</Text>
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={debtAmount}
              onChangeText={setDebtAmount}
              keyboardType="numeric"
              placeholder="Amount"
            />
            <Text style={styles.inputLabel}>Due Date</Text>
            <TextInput
              style={styles.textInputStyle}
              value={debtDueDate}
              onChangeText={setDebtDueDate}
              placeholder="YYYY-MM-DD"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateDebt}>
              <Text style={styles.actionBtnTextText}>Save Debt Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('CustomerDebts')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Payments' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Customer Payments')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { calculatePaymentSummary(); setCurrentScreen('PaymentSummary'); }}>
            <Text style={styles.secondaryActionText}>View Payment Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('NewPayment'); setPaymentForm({ customer_id: '', debt_id: '', amount: '0', payment_method: 'Cash', notes: '' }); }}>
            <Text style={styles.secondaryActionText}>+ Record New Payment</Text>
          </TouchableOpacity>
          {payments.map((payment) => (
            <View key={payment.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>TZS {payment.amount} • {payment.payment_method}</Text>
                <Text style={styles.cardSubtitle}>{payment.customer_name || `Customer ${payment.customer_id || 'N/A'}`} • {payment.paid_at || payment.created_at || 'No date'}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => loadPaymentForEdit(payment)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deletePayment(payment)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'PaymentSummary' && userSession && paymentSummary && (
        <ScrollView style={[styles.dashboardContainer, styles.glassScreenBackground]}>
          {renderHeader('Payment Summary')}
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Total Payments</Text>
            <Text style={[styles.statsValue, { color: '#60A5FA' }]}>{paymentSummary.total_payments}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardGold, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Total Received</Text>
            <Text style={[styles.statsValue, { color: '#FBBF24' }]}>TZS {(paymentSummary.total_amount || 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Average Payment</Text>
            <Text style={[styles.statsValue, { color: '#38BDF8' }]}>TZS {(paymentSummary.average_payment || 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 14 }]}> 
            <Text style={styles.statsLabel}>Last Payment Date</Text>
            <Text style={[styles.statsValue, { color: '#E2E8F0' }]}>{paymentSummary.last_payment_date}</Text>
          </View>
          {paymentSummaryChart?.bar && (
            <View style={[styles.statsCard, styles.glassCardAccent, { marginBottom: 18, width: '100%' }]}> 
              <Text style={[styles.statsLabel, { marginBottom: 10 }]}>Recent Payment Amounts</Text>
              <BarChart
                data={{ labels: paymentSummaryChart.bar.labels, datasets: [{ data: paymentSummaryChart.bar.data }] }}
                width={Dimensions.get('window').width - 64}
                height={200}
                yAxisLabel="TZS "
                chartConfig={{
                  backgroundGradientFrom: '#071426',
                  backgroundGradientTo: '#0F1F3B',
                  color: () => '#60A5FA',
                  labelColor: () => '#CBD5E1',
                  style: { borderRadius: 20 }
                }}
                style={{ borderRadius: 20 }}
              />
            </View>
          )}
          {paymentSummaryChart?.pie && paymentSummaryChart.pie.length > 0 && (
            <View style={[styles.statsCard, styles.glassCardAccent, { marginBottom: 18, width: '100%' }]}> 
              <Text style={[styles.statsLabel, { marginBottom: 10 }]}>Payment Method Breakdown</Text>
              <PieChart
                data={paymentSummaryChart.pie}
                width={Dimensions.get('window').width - 64}
                height={180}
                chartConfig={{
                  backgroundGradientFrom: '#071426',
                  backgroundGradientTo: '#0F1F3B',
                  color: () => '#E2E8F0',
                  labelColor: () => '#E2E8F0'
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          )}
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('Payments')}>
            <Text style={styles.actionBtnTextText}>Back to Payments</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'CustomerAging' && userSession && (
        <ScrollView style={[styles.dashboardContainer, styles.glassScreenBackground]}>
          {renderHeader('Customer Aging Report')}
          <View style={[styles.statsCard, styles.glassCardAccent, { marginVertical: 12 }]}> 
            <Text style={styles.statsLabel}>Aging totals by bucket</Text>
            {(agingReport?.totals || []).map((bucket) => (
              <View key={bucket.aging_category} style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 }}>
                <Text style={styles.cardSubtitle}>{bucket.aging_category}</Text>
                <Text style={[styles.statsValue, { color: '#E2E8F0' }]}>TZS {parseFloat(bucket.bucket_total || 0).toFixed(2)}</Text>
              </View>
            ))}
            {(!agingReport?.totals || agingReport.totals.length === 0) && (
              <Text style={styles.statsLabel}>No outstanding customer balances found.</Text>
            )}
          </View>

          {(agingReport?.aging || []).map((item) => (
            <View key={`${item.customer_id}-${item.aging_category}`} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{item.customer_name}</Text>
                <Text style={styles.cardSubtitle}>Outstanding: TZS {item.outstanding_balance}</Text>
                <Text style={styles.cardSubtitle}>Aging: {item.aging_category} • {Math.round(item.overdue_days)} days overdue</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.primaryActionButton} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'NewPayment' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Record Payment')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Customer ID</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.customer_id}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, customer_id: value }))}
              placeholder="Customer ID"
            />
            <Text style={styles.inputLabel}>Debt ID (Optional)</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.debt_id}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, debt_id: value }))}
              placeholder="Debt ID"
            />
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.amount}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, amount: value }))}
              placeholder="Amount"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Payment Method</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.payment_method}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
              placeholder="Cash or Mobile Money"
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.notes}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={savePayment}>
              <Text style={styles.actionBtnTextText}>Save Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Payments')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditPayment' && userSession && selectedPayment && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Payment')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Customer ID</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.customer_id}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, customer_id: value }))}
              placeholder="Customer ID"
            />
            <Text style={styles.inputLabel}>Debt ID (Optional)</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.debt_id}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, debt_id: value }))}
              placeholder="Debt ID"
            />
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.amount}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, amount: value }))}
              placeholder="Amount"
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Payment Method</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.payment_method}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
              placeholder="Cash or Mobile Money"
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.notes}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={updatePayment}>
              <Text style={styles.actionBtnTextText}>Save Payment Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryActionButton, { backgroundColor: '#DC2626' }]} onPress={() => deletePayment(selectedPayment)}>
              <Text style={styles.secondaryActionText}>Delete Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Payments')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'CustomerLedger' && userSession && ledgerEntries && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Customer Ledger')}
          <Text style={[styles.statsLabel, { marginBottom: 10 }]}>Customer ID: {ledgerEntries.customerId}</Text>
          <Text style={[styles.statsLabel, { marginBottom: 6 }]}>Debts</Text>
          {ledgerEntries.debts.map((debt) => (
            <View key={debt.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>TZS {debt.amount} • {debt.status}</Text>
                <Text style={styles.cardSubtitle}>{debt.sale_reference || 'Reference'} • Due {debt.due_date || 'N/A'}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.statsLabel, { marginTop: 12, marginBottom: 6 }]}>Payments</Text>
          {ledgerEntries.payments.map((payment) => (
            <View key={payment.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>TZS {payment.amount}</Text>
                <Text style={styles.cardSubtitle}>{payment.payment_method} • {payment.paid_at}</Text>
              </View>
              <TouchableOpacity style={[styles.inlineButton, { marginLeft: 8 }]} onPress={() => loadPaymentForEdit(payment)}>
                <Text style={styles.inlineButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Apply Payment</Text>
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.debt_id}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, debt_id: value }))}
              placeholder="Debt ID (optional)"
            />
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.amount}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, amount: value }))}
              placeholder="Amount"
            />
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.payment_method}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
              placeholder="Payment method"
            />
            <TextInput
              style={styles.textInputStyle}
              value={paymentForm.notes}
              onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={applyPayment}>
              <Text style={styles.actionBtnTextText}>Apply Payment</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.secondaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('CustomerDebts')}>
            <Text style={styles.secondaryActionText}>Back to Debt Ledger</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'Vehicles' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Fleet Management')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('AddVehicle'); setVehicleForm({ plate: '', type: '', capacity: '', status: 'Active', assigned_driver_id: '' }); }}>
            <Text style={styles.secondaryActionText}>+ Register Vehicle</Text>
          </TouchableOpacity>
          {vehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{vehicle.plate} - {vehicle.type}</Text>
                <Text style={styles.cardSubtitle}>{vehicle.capacity || 'Capacity not set'} • {vehicle.status}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddVehicle' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Register Vehicle')}
          <View style={styles.formContainer}>
            {['plate', 'type', 'capacity', 'status', 'assigned_driver_id'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={vehicleForm[field]}
                  onChangeText={(value) => setVehicleForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveVehicle}>
              <Text style={styles.actionBtnTextText}>Save Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Vehicles')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Deliveries' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Delivery Tracking')}
          <View style={[styles.formContainer, { marginBottom: 12, backgroundColor: 'rgba(20,184,166,0.08)' }]}> 
            <Text style={styles.inputLabel}>Driver Sprint</Text>
            <Text style={styles.cardSubtitle}>Total active deliveries: {deliveries?.filter((d) => d.status !== 'Delivered').length ?? 0}</Text>
            <Text style={styles.cardSubtitle}>Next ETA: {deliveries?.find((d) => d.eta)?.eta || 'Not scheduled'}</Text>
          </View>
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setCurrentScreen('AddDelivery'); setDeliveryForm({ driver_id: '', vehicle_id: '', customer_name: '', customer_address: '', destination: '', status: 'Pending', route_start: '', route_end: '', distance_km: '0', eta: '' }); }}>
            <Text style={styles.secondaryActionText}>+ Schedule Delivery</Text>
          </TouchableOpacity>
          {deliveries.map((delivery) => (
            <View key={delivery.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{delivery.destination}</Text>
                <Text style={styles.cardSubtitle}>{delivery.customer_name || 'Customer not set'} • {delivery.status} • ETA {delivery.eta || 'TBD'}</Text>
              </View>
              <TouchableOpacity style={styles.inlineButton} onPress={() => loadDeliveryDetails(delivery.id)}>
                <Text style={styles.inlineButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'Suppliers' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Suppliers')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setSelectedSupplier(null); setSupplierForm({ name: '', contact_person: '', phone: '', email: '', address: '', rating: '0', notes: '' }); setCurrentScreen('AddSupplier'); }}>
            <Text style={styles.secondaryActionText}>+ Add Supplier</Text>
          </TouchableOpacity>
          {suppliers.map((supplier) => (
            <View key={supplier.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{supplier.name}</Text>
                <Text style={styles.cardSubtitle}>{supplier.phone || 'No phone'} • {supplier.email || 'No email'}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => loadSupplierForEdit(supplier)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deleteSupplier(supplier)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddSupplier' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Add Supplier')}
          <View style={styles.formContainer}>
            {['name', 'contact_person', 'phone', 'email', 'address', 'rating', 'notes'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={supplierForm[field]}
                  onChangeText={(value) => setSupplierForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveSupplier}>
              <Text style={styles.actionBtnTextText}>Save Supplier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Suppliers')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditSupplier' && userSession && selectedSupplier && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Supplier')}
          <View style={styles.formContainer}>
            {['name', 'contact_person', 'phone', 'email', 'address', 'rating', 'notes'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={supplierForm[field]}
                  onChangeText={(value) => setSupplierForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateSupplier}>
              <Text style={styles.actionBtnTextText}>Update Supplier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Suppliers')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'PurchaseOrders' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Purchase Orders')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setSelectedPurchaseOrder(null); setPurchaseOrderForm({ supplier_id: '', order_number: '', status: 'Pending', total_amount: '0', currency: 'TZS', expected_delivery_date: '', notes: '' }); setCurrentScreen('AddPurchaseOrder'); }}>
            <Text style={styles.secondaryActionText}>+ Add Purchase Order</Text>
          </TouchableOpacity>
          {purchaseOrders.map((order) => (
            <View key={order.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{order.order_number}</Text>
                <Text style={styles.cardSubtitle}>{order.supplier_name || 'Supplier not set'} • TZS {order.total_amount}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => loadPurchaseOrderForEdit(order)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deletePurchaseOrder(order)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddPurchaseOrder' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Add Purchase Order')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Supplier ID</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.supplier_id}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, supplier_id: value }))}
              placeholder="Supplier ID"
            />
            <Text style={styles.inputLabel}>Order Number</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.order_number}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, order_number: value }))}
              placeholder="Order number"
            />
            <Text style={styles.inputLabel}>Status</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.status}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, status: value }))}
              placeholder="Pending / Approved / Received"
            />
            <Text style={styles.inputLabel}>Total Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.total_amount}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, total_amount: value }))}
              keyboardType="numeric"
              placeholder="Total amount"
            />
            <Text style={styles.inputLabel}>Expected Delivery</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.expected_delivery_date}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, expected_delivery_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.notes}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={savePurchaseOrder}>
              <Text style={styles.actionBtnTextText}>Save Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('PurchaseOrders')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditPurchaseOrder' && userSession && selectedPurchaseOrder && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Purchase Order')}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Supplier ID</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.supplier_id}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, supplier_id: value }))}
              placeholder="Supplier ID"
            />
            <Text style={styles.inputLabel}>Order Number</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.order_number}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, order_number: value }))}
              placeholder="Order number"
            />
            <Text style={styles.inputLabel}>Status</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.status}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, status: value }))}
              placeholder="Pending / Approved / Received"
            />
            <Text style={styles.inputLabel}>Total Amount</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.total_amount}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, total_amount: value }))}
              keyboardType="numeric"
              placeholder="Total amount"
            />
            <Text style={styles.inputLabel}>Expected Delivery</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.expected_delivery_date}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, expected_delivery_date: value }))}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.textInputStyle}
              value={purchaseOrderForm.notes}
              onChangeText={(value) => setPurchaseOrderForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notes"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={updatePurchaseOrder}>
              <Text style={styles.actionBtnTextText}>Update Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('PurchaseOrders')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'Attendance' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Attendance')}
          <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setSelectedAttendance(null); setAttendanceForm({ user_id: '', work_date: '', status: 'Present', check_in: '', check_out: '', notes: '' }); setCurrentScreen('AddAttendance'); }}>
            <Text style={styles.secondaryActionText}>+ Add Attendance</Text>
          </TouchableOpacity>
          {attendanceRecords.map((record) => (
            <View key={record.id} style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.statsLabel}>{record.employee_name || `Employee ${record.user_id}`}</Text>
                <Text style={styles.cardSubtitle}>{record.work_date} • {record.status}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.inlineButton, { marginRight: 8 }]} onPress={() => loadAttendanceForEdit(record)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.inlineButton, { backgroundColor: '#DC2626' }]} onPress={() => deleteAttendance(record)}>
                  <Text style={styles.inlineButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity style={[styles.primaryActionButton, { marginTop: 16 }]} onPress={() => setCurrentScreen('BossDashboard')}>
            <Text style={styles.actionBtnTextText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentScreen === 'AddAttendance' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Record Attendance')}
          <View style={styles.formContainer}>
            {['user_id', 'work_date', 'status', 'check_in', 'check_out', 'notes'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={attendanceForm[field]}
                  onChangeText={(value) => setAttendanceForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveAttendance}>
              <Text style={styles.actionBtnTextText}>Save Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Attendance')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'EditAttendance' && userSession && selectedAttendance && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Edit Attendance')}
          <View style={styles.formContainer}>
            {['user_id', 'work_date', 'status', 'check_in', 'check_out', 'notes'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={attendanceForm[field]}
                  onChangeText={(value) => setAttendanceForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateAttendance}>
              <Text style={styles.actionBtnTextText}>Update Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Attendance')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'AddDelivery' && userSession && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Schedule Delivery')}
          <View style={styles.formContainer}>
            {['driver_id', 'vehicle_id', 'customer_name', 'customer_address', 'destination', 'status', 'route_start', 'route_end', 'distance_km', 'eta'].map((field) => (
              <View key={field} style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>{field.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                <TextInput
                  style={styles.textInputStyle}
                  value={deliveryForm[field]}
                  onChangeText={(value) => setDeliveryForm((prev) => ({ ...prev, [field]: value }))}
                  placeholder={`Enter ${field.replace('_', ' ')}`}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.primaryActionButton} onPress={saveDelivery}>
              <Text style={styles.actionBtnTextText}>Create Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Deliveries')}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {currentScreen === 'DeliveryDetail' && userSession && selectedDelivery && (
        <ScrollView style={styles.dashboardContainer}>
          {renderHeader('Delivery Details')}
          <View style={styles.formContainer}>
            <Text style={styles.statsLabel}>Destination: {selectedDelivery.destination}</Text>
            <Text style={styles.cardSubtitle}>Customer: {selectedDelivery.customer_name}</Text>
            <Text style={styles.cardSubtitle}>Vehicle ID: {selectedDelivery.vehicle_id || 'N/A'}</Text>
            <Text style={styles.cardSubtitle}>Driver ID: {selectedDelivery.driver_id || 'N/A'}</Text>
            <Text style={styles.cardSubtitle}>Status: {selectedDelivery.status}</Text>
            <Text style={styles.cardSubtitle}>ETA: {selectedDelivery.eta || 'N/A'}</Text>
            <Text style={styles.inputLabel}>Update Status</Text>
            <TextInput
              style={styles.textInputStyle}
              value={deliveryStatusForm.status}
              onChangeText={(value) => setDeliveryStatusForm((prev) => ({ ...prev, status: value }))}
              placeholder="Pending / In Transit / Delivered"
            />
            <Text style={styles.inputLabel}>Proof of Delivery URL</Text>
            <TextInput
              style={styles.textInputStyle}
              value={deliveryStatusForm.proof_of_delivery_url}
              onChangeText={(value) => setDeliveryStatusForm((prev) => ({ ...prev, proof_of_delivery_url: value }))}
              placeholder="Enter proof URL"
            />
            <TouchableOpacity style={styles.primaryActionButton} onPress={updateDeliveryStatus}>
              <Text style={styles.actionBtnTextText}>Update Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setCurrentScreen('Deliveries')}>
              <Text style={styles.secondaryActionText}>Back to Deliveries</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#020814', paddingTop: (Constants.statusBarHeight || 12) + 12 },
  loginScreenWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#020814' },
  loginBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#020814' },
  loginGradientOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13, 32, 68, 0.34)' },
  loginWatermarkContainer: { position: 'absolute', top: '35%', left: 0, right: 0, alignItems: 'center', opacity: 0.08 },
  loginWatermark: { fontSize: 72, fontWeight: '900', color: '#FFFFFF', letterSpacing: 14, textTransform: 'uppercase' },
  loginCard: { width: '100%', maxWidth: 420, backgroundColor: 'rgba(12, 20, 42, 0.88)', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)', shadowColor: '#0B2444', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.26, shadowRadius: 32, elevation: 18 },
  startupScreen: { flex: 1, backgroundColor: '#020814', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  startupCard: { width: '100%', maxWidth: 420, backgroundColor: 'rgba(10, 18, 36, 0.96)', borderRadius: 28, padding: 26, borderWidth: 1, borderColor: 'rgba(109, 116, 129, 0.18)', shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 16, alignItems: 'center' },
  startupBadgeText: { color: '#FACC15', fontSize: 14, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 16, opacity: 0.96 },
  startupTitle: { color: '#F8FAFC', fontSize: 48, fontWeight: '900', letterSpacing: 5, textTransform: 'uppercase', marginTop: 20, marginBottom: 8, textAlign: 'center', textShadowColor: 'rgba(96, 165, 250, 0.35)', textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 18 },
  startupLabel: { color: '#D1D5DB', fontSize: 18, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center', opacity: 0.88 },
  startupFeatureBadgeCombined: { alignSelf: 'center', backgroundColor: 'rgba(250, 204, 21, 0.12)', borderColor: 'rgba(250, 204, 21, 0.34)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 16, shadowColor: '#FACC15', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 12 },
  startupFeatureText: { color: '#FACC15', fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  startupLogoPulse: { width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: 'rgba(59, 130, 246, 0.08)' },
  startupLogoFrame: { width: 220, height: 220, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  startupLogoRim: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 32, borderWidth: 5, borderColor: 'rgba(59,130,246,0.9)', opacity: 0.95, shadowColor: '#0EA5FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 16 },
  
  startupProgressBar: { width: '100%', height: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 10, marginBottom: 10 },
  startupProgressFill: { width: '45%', height: '100%', backgroundColor: '#3B82F6', borderRadius: 12 },
  startupHint: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 340 },
  loginLogoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginLogoCard: {
    width: 260,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 18,
    overflow: 'hidden'
  },
  loginLogoCodeHeader: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  codeWindowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(12, 18, 34, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  codeWindowDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#FACC15',
    marginRight: 6,
  },
  startupTerminal: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(9, 16, 32, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 18,
  },
  startupStatus: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  startupLogo: {
    width: 178,
    height: 178,
  },
  loginLogoCodeText: {
    color: '#8ab4f8',
    fontFamily: 'Courier',
    fontSize: 12,
    textAlign: 'center'
  },
  loginLogo: {
    width: 240,
    height: 240,
    borderRadius: 26,
    marginVertical: 16,
  },
  loginLogoLarge: {
    width: 220,
    height: 220,
    borderRadius: 24,
    marginVertical: 14,
  },
  loginLogoMetaRow: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginTop: 16,
  },
  loginLogoCaption: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.85,
    maxWidth: '84%',
  },
  loginLogoCodeFooter: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  loginLogoFooterText: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700'
  },
  brandTitle: { fontSize: 34, fontWeight: '900', color: '#F8FAFC', letterSpacing: 3, textAlign: 'center' },
  brandSubtitle: { fontSize: 13, color: '#A8B8D2', textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 22, letterSpacing: 0.4 },
  formContainer: { backgroundColor: 'rgba(9, 18, 36, 0.96)', padding: 26, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.14)' },
  inputLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginBottom: 10, marginTop: 18 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.16)', paddingHorizontal: 14, marginBottom: 16 },
  fieldIcon: { fontSize: 18, marginRight: 12, color: '#FACC15' },
  textInputStyle: { flex: 1, backgroundColor: 'transparent', color: '#F8FAFC', paddingVertical: 16, paddingHorizontal: 8, fontSize: 15, letterSpacing: 0.3 },
  loginButton: { marginTop: 18, backgroundColor: '#1D4ED8', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 10 },
  loginButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.7 },
  linkButton: { marginTop: 14, paddingVertical: 12, alignItems: 'center' },
  linkButtonText: { color: '#FACC15', fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  primaryActionButton: { backgroundColor: '#2563EB', paddingVertical: 18, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center', marginTop: 22, minHeight: 52, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 8 },
  actionBtnTextText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  secondaryActionButton: { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(148, 163, 184, 0.22)', borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', marginTop: 14, minHeight: 48, justifyContent: 'center' },
  secondaryActionText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  dashboardContainer: { flex: 1, backgroundColor: '#020814', padding: 20 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.14)', paddingTop: 14, paddingBottom: 18, marginTop: 18 },
  welcomeTxt: { fontSize: 13, color: '#94A3B8' },
  userNameTitle: { fontSize: 22, fontWeight: '900', color: '#F8FAFC' },
  userRoleTag: { fontSize: 12, color: '#FACC15', fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  logoutBtn: { backgroundColor: 'rgba(255, 255, 255, 0.08)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.22)' },
  logoutBtnTxt: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  enterpriseTitleSection: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', marginTop: 26, marginBottom: 16 },
  statsCardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statsCard: { backgroundColor: 'rgba(12, 21, 42, 0.93)', width: '48%', minWidth: '48%', padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderLeftWidth: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 6 },
  statsLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  statsValue: { fontSize: 18, fontWeight: '900', marginTop: 8, color: '#F8FAFC' },
  sectionDividerHeader: { fontSize: 15, fontWeight: '700', color: '#E2E8F0', marginTop: 24, marginBottom: 14 },
  quickActionsFlexRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardRow: { backgroundColor: 'rgba(8, 16, 34, 0.88)', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.14)', marginBottom: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 5 },
  inlineButton: { backgroundColor: '#2563EB', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  inlineButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  shortcutBtnItem: { backgroundColor: 'rgba(14, 29, 54, 0.95)', padding: 16, borderRadius: 18, flex: 1, marginRight: 10, marginBottom: 10, alignItems: 'center', minWidth: '46%', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.14)' },
  shortcutBtnItemText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bossDashboardContainer: { backgroundColor: 'rgba(3, 9, 24, 0.98)', paddingBottom: 26 },
  sellerDashboardContainer: { backgroundColor: 'rgba(3, 9, 24, 0.98)', paddingBottom: 26 },
  premiumBanner: { backgroundColor: 'rgba(26, 46, 82, 0.96)', padding: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)', marginTop: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  premiumBannerTitle: { fontSize: 17, fontWeight: '900', color: '#FACC15', marginBottom: 8 },
  premiumBannerText: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  bossStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  sellerBanner: { backgroundColor: 'rgba(110, 57, 4, 0.12)', padding: 16, borderRadius: 18, marginVertical: 16, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.24)' },
  sellerBannerText: { color: '#F8FAFC', fontSize: 13, lineHeight: 20 },
  glassCardAccent: { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(148, 163, 184, 0.18)' },
  glassCardGold: { backgroundColor: 'rgba(83, 65, 29, 0.88)', borderColor: 'rgba(251, 191, 36, 0.24)' },
  pickerContainer: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.12)', marginBottom: 12, overflow: 'hidden' },
  pickerStyle: { color: '#F8FAFC', height: 48 },
  glassScreenBackground: { backgroundColor: 'rgba(4, 16, 31, 0.97)' }
});
