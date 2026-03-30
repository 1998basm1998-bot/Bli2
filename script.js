// المتغيرات العامة
let rides = [];
let driverProfile = JSON.parse(localStorage.getItem('driverProfile')) || { status: 'متاح' };
let currentFilter = 'all';
let mapInstance = null; // متغير لحفظ حالة خريطة Leaflet
let selectedRideForMap = null;

// 1. التهيئة عند تحميل الصفحة
window.onload = () => {
    loadData();
    renderAccountData();
    updateDriverStatusUI();
    
    // محاكاة تحديث البيانات كل 5 ثواني لرؤية طلبات المستخدم فوراً
    setInterval(loadData, 5000); 
};

// 2. تحميل البيانات من LocalStorage
function loadData() {
    // نجلب مصفوفة myRides التي خزنها تطبيق المستخدم
    const storedRides = JSON.parse(localStorage.getItem('myRides')) || [];
    
    // نتحقق إذا كان هناك تغيير في البيانات لنقوم بإعادة الرسم فقط عند الحاجة
    if(JSON.stringify(rides) !== JSON.stringify(storedRides)) {
        rides = storedRides;
        updateDashboardStats();
        renderRequests();
        renderHistory();
        renderLastRide();
    }
}

// 3. التنقل بين التبويبات
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    // إذا تم فتح الخارطة، نحتاج لتحديث أبعاد الخريطة لتعمل بشكل صحيح
    if (tabId === 'map-view' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 100);
    }
}

// 4. نظام الإشعارات (Toast)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    
    if(type === 'error') toast.style.borderRightColor = '#dc2626';
    if(type === 'info') toast.style.borderRightColor = '#2563eb';

    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// 5. تحديث إحصائيات لوحة القيادة (الرئيسية)
function updateDashboardStats() {
    const newRides = rides.filter(r => r.status === 'جاري البحث عن سائق' || r.status === 'بانتظار القبول').length;
    const completedRides = rides.filter(r => r.status === 'انتهت الرحلة').length;
    const canceledRides = rides.filter(r => r.status === 'مرفوض' || r.status === 'ملغية').length;

    document.getElementById('stat-new').innerText = newRides;
    document.getElementById('stat-completed').innerText = completedRides;
    document.getElementById('stat-canceled').innerText = canceledRides;
}

// 6. عرض آخر طلب في الرئيسية
function renderLastRide() {
    const container = document.getElementById('last-ride-summary');
    if(rides.length === 0) {
        container.innerHTML = 'لا توجد طلبات مسجلة.';
        return;
    }
    const last = rides[rides.length - 1]; // أحدث طلب أضيف في نهاية المصفوفة
    container.innerHTML = `
        <div class="card-header">
            <strong>من: ${last.pickup}</strong>
            <span class="badge ${getBadgeClass(last.status)}">${last.status}</span>
        </div>
        <p>إلى: ${last.dropoff} | السعر: ${last.cost} د.ع</p>
    `;
}

// 7. تحديد لون حالة الطلب
function getBadgeClass(status) {
    if(status.includes('جاري') || status.includes('بانتظار')) return 'status-waiting';
    if(status === 'تم قبول الطلب') return 'status-accepted';
    if(status === 'بدأت الرحلة' || status === 'السائق بالطريق') return 'status-started';
    if(status === 'انتهت الرحلة') return 'status-ended';
    return 'status-rejected'; // مرفوض أو ملغية
}

// 8. عرض الطلبات (تبويب الطلبات)
function filterRequests(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderRequests();
}

function renderRequests() {
    const list = document.getElementById('requests-list');
    list.innerHTML = '';

    // إخفاء الرحلات المنتهية أو المرفوضة من قائمة "الطلبات الحالية" (نتركها لسجل رحلاتي)
    let activeRides = rides.filter(r => r.status !== 'انتهت الرحلة' && r.status !== 'مرفوض');

    if (currentFilter === 'new') {
        activeRides = activeRides.filter(r => r.status === 'جاري البحث عن سائق' || r.status === 'بانتظار القبول');
    }

    if (activeRides.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#ccc; margin-top:20px;">لا توجد طلبات حالياً.</p>';
        return;
    }

    // عكس الترتيب ليظهر الأحدث أولاً
    [...activeRides].reverse().forEach(ride => {
        // إذا لم يكن هناك اسم للزبون في التطبيق الأول، نضع اسماً افتراضياً
        const customerName = ride.customerName || 'زبون جديد';
        const phone = ride.phone || 'غير متوفر';

        const card = document.createElement('div');
        card.className = 'ride-card';
        card.innerHTML = `
            <div class="card-header">
                <strong><i class="fas fa-user"></i> ${customerName}</strong>
                <span class="badge ${getBadgeClass(ride.status)}">${ride.status === 'جاري البحث عن سائق' ? 'بانتظار القبول' : ride.status}</span>
            </div>
            <div class="card-details">
                <p><i class="fas fa-map-marker-alt" style="color:#d97706"></i> <strong>من:</strong> ${ride.pickup}</p>
                <p><i class="fas fa-flag-checkered" style="color:#16a34a"></i> <strong>إلى:</strong> ${ride.dropoff}</p>
                <p><i class="fas fa-car"></i> <strong>السيارة:</strong> ${ride.carType}</p>
                <p><i class="fas fa-money-bill-wave"></i> <strong>السعر التقديري:</strong> ${ride.cost} د.ع</p>
                ${ride.notes ? `<p><i class="fas fa-comment"></i> <strong>ملاحظات:</strong> ${ride.notes}</p>` : ''}
                <p><i class="fas fa-clock"></i> ${ride.date}</p>
            </div>
            <div class="action-buttons">
                ${getButtonsForStatus(ride.status, ride.id)}
            </div>
        `;
        list.appendChild(card);
    });
}

// 9. الأزرار الديناميكية حسب الحالة
function getButtonsForStatus(status, id) {
    if (status === 'جاري البحث عن سائق' || status === 'بانتظار القبول') {
        return `
            <button class="btn success-btn" onclick="updateRideStatus(${id}, 'تم قبول الطلب')">قبول الطلب</button>
            <button class="btn danger-btn" onclick="updateRideStatus(${id}, 'مرفوض')">رفض</button>
            <button class="btn calc-btn" onclick="viewOnMap(${id})" style="width:100%">تحديده على الخارطة <i class="fas fa-map"></i></button>
        `;
    } else if (status === 'تم قبول الطلب') {
        return `
            <button class="btn primary-btn" onclick="updateRideStatus(${id}, 'بدأت الرحلة')">بدء الرحلة</button>
            <button class="btn calc-btn" onclick="viewOnMap(${id})">الخارطة</button>
            <button class="btn danger-btn" onclick="updateRideStatus(${id}, 'ملغية')" style="width:100%; margin-top:5px;">إلغاء الطلب</button>
        `;
    } else if (status === 'بدأت الرحلة') {
        return `
            <button class="btn success-btn" onclick="updateRideStatus(${id}, 'انتهت الرحلة')" style="width:100%">إنهاء الرحلة بنجاح</button>
            <button class="btn calc-btn" onclick="viewOnMap(${id})" style="width:100%; margin-top:5px;">متابعة على الخارطة</button>
        `;
    }
    return '';
}

// 10. تحديث حالة الطلب وحفظها في التخزين المحلي
function updateRideStatus(id, newStatus) {
    const rideIndex = rides.findIndex(r => r.id === id);
    if(rideIndex > -1) {
        rides[rideIndex].status = newStatus;
        localStorage.setItem('myRides', JSON.stringify(rides)); // حفظ للمتصفح ليقرأه تطبيق المستخدم
        showToast(`تم تغيير الحالة إلى: ${newStatus}`);
        loadData(); // إعادة رسم الشاشات
    }
}

// 11. عرض الطلب على الخارطة (مكتبة Leaflet)
function viewOnMap(id) {
    const ride = rides.find(r => r.id === id);
    if(!ride) return;
    
    selectedRideForMap = ride;
    
    // تعبئة بطاقة معلومات الخريطة
    const infoCard = document.getElementById('map-info-card');
    infoCard.style.display = 'block';
    infoCard.innerHTML = `
        <div class="card-header">
            <strong>رحلة الزبون</strong>
            <span class="badge ${getBadgeClass(ride.status)}">${ride.status}</span>
        </div>
        <p><strong>الانطلاق:</strong> ${ride.pickup}</p>
        <p><strong>الوجهة:</strong> ${ride.dropoff}</p>
        <p><strong>التكلفة:</strong> ${ride.cost} د.ع</p>
    `;
    
    document.getElementById('map-actions').style.display = 'flex';
    switchTab('map-view');
    
    // رسم الخريطة (نستخدم إحداثيات وهمية لمركز المدينة مثلاً لأن التطبيق لا يملك GPS حقيقي للوجهة)
    // الإحداثيات الوهمية لبغداد مثلا: 33.3152, 44.3661
    setTimeout(() => {
        if(!mapInstance) {
            mapInstance = L.map('map-container').setView([33.3152, 44.3661], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(mapInstance);
        } else {
            // إعادة ضبط حجم الخريطة
            mapInstance.invalidateSize();
        }

        // مسح العلامات السابقة إن وجدت
        mapInstance.eachLayer((layer) => {
            if (layer instanceof L.Marker) { mapInstance.removeLayer(layer); }
        });

        // إضافة علامة انطلاق ووجهة وهمية حول المركز لتوضيح الفكرة
        const startLat = 33.3152 + (Math.random() - 0.5) * 0.02;
        const startLng = 44.3661 + (Math.random() - 0.5) * 0.02;
        const endLat = startLat + 0.01;
        const endLng = startLng + 0.01;

        L.marker([startLat, startLng]).addTo(mapInstance).bindPopup("<b>نقطة الانطلاق</b><br>"+ride.pickup).openPopup();
        L.marker([endLat, endLng]).addTo(mapInstance).bindPopup("<b>الوجهة</b><br>"+ride.dropoff);
        
        // رسم خط بينهما (تخيلي)
        L.polyline([[startLat, startLng], [endLat, endLng]], {color: '#c28147', weight: 4}).addTo(mapInstance);
        
        // توجيه الخريطة لتشمل النقطتين
        mapInstance.fitBounds([[startLat, startLng], [endLat, endLng]]);
        
    }, 200);
}

// 12. عرض سجل الرحلات (تبويب رحلاتي)
function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    const historyRides = rides.filter(r => r.status === 'انتهت الرحلة' || r.status === 'مرفوض' || r.status === 'ملغية');
    
    if (historyRides.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#ccc; margin-top:20px;">لا يوجد سجل رحلات سابق.</p>';
        return;
    }

    [...historyRides].reverse().forEach(ride => {
        const card = document.createElement('div');
        card.className = 'ride-card';
        card.innerHTML = `
            <div class="card-header">
                <strong>التاريخ: ${ride.date.split(',')[0]}</strong>
                <span class="badge ${getBadgeClass(ride.status)}">${ride.status}</span>
            </div>
            <div class="card-details">
                <p><strong>المسار:</strong> من ${ride.pickup} إلى ${ride.dropoff}</p>
                <p><strong>السعر:</strong> ${ride.cost} د.ع</p>
            </div>
        `;
        list.appendChild(card);
    });
}

// 13. وظائف حساب السائق
function renderAccountData() {
    document.getElementById('driver-name').value = driverProfile.name || '';
    document.getElementById('driver-phone').value = driverProfile.phone || '';
    document.getElementById('driver-car').value = driverProfile.car || '';
    document.getElementById('driver-city').value = driverProfile.city || '';
}

function saveDriverProfile() {
    driverProfile.name = document.getElementById('driver-name').value;
    driverProfile.phone = document.getElementById('driver-phone').value;
    driverProfile.car = document.getElementById('driver-car').value;
    driverProfile.city = document.getElementById('driver-city').value;
    
    localStorage.setItem('driverProfile', JSON.stringify(driverProfile));
    showToast('تم حفظ بيانات الحساب بنجاح');
}

function fillMockProfile() {
    document.getElementById('driver-name').value = 'أحمد محمد';
    document.getElementById('driver-phone').value = '07801234567';
    document.getElementById('driver-car').value = 'هيونداي النترا 2022';
    document.getElementById('driver-city').value = 'بغداد';
    showToast('تم تعبئة البيانات التجريبية', 'info');
}

function toggleDriverStatus() {
    if(driverProfile.status === 'متاح') {
        driverProfile.status = 'غير متاح';
    } else {
        driverProfile.status = 'متاح';
    }
    localStorage.setItem('driverProfile', JSON.stringify(driverProfile));
    updateDriverStatusUI();
    showToast(`تغيرت حالتك إلى: ${driverProfile.status}`, 'info');
}

function updateDriverStatusUI() {
    const badge = document.getElementById('driver-status-badge');
    badge.innerText = driverProfile.status;
    if(driverProfile.status === 'متاح') {
        badge.className = 'badge status-available';
    } else {
        badge.className = 'badge status-unavailable';
    }
}
