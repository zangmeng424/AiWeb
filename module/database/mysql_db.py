from mysql.connector import pooling, Error
from contextlib import contextmanager

#pip install mysql-connector-python


class MySQLDatabaseHandler:
    def __init__(self, host: str, database: str, user: str, password: str, port: int = 3306, pool_size: int = 5):
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.port = port
        self.pool_size = pool_size
        self.connection_pool = None
        self._initialize_pool()

    def _initialize_pool(self):
        try:
            self.connection_pool = pooling.MySQLConnectionPool(
                pool_name="mysql_pool",
                pool_size=self.pool_size,
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password,
                port=self.port,
                connection_timeout=10,
                ssl_disabled=True,
                use_pure=True,
            )
            print("✅ MySQL连接池创建成功")
        except Error as e:
            print(f"❌ 创建连接池失败: {e}")
            self.connection_pool = None

    @contextmanager
    def get_connection_cursor(self):
        """上下文方式获取连接和游标，自动释放"""
        conn = None
        cursor = None
        try:
            conn = self.connection_pool.get_connection()
            cursor = conn.cursor(dictionary=True)
            yield cursor, conn
        except Error as e:
            error_msg = f"❌ 获取连接或游标失败: {e}"
            raise Exception(error_msg) from e
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()  # 自动归还连接池
                # print("🔁 连接归还到连接池")


    def query(self, sql, params=None):
        with self.get_connection_cursor() as (cursor, conn):
            cursor.execute(sql, params)
            return cursor.fetchall()

    def execute(self, sql, params=None):
        with self.get_connection_cursor() as (cursor, conn):
            cursor.execute(sql, params)
            conn.commit()

    def close_pool(self):
        """彻底清理连接池"""
        if self.connection_pool:
            self.connection_pool._remove_connections()
            print("🧹 连接池已关闭")



def init_mysql() -> MySQLDatabaseHandler:
    from config_dev import mysql_host, mysql_port, mysql_username, mysql_password, mysql_db, mysql_pool_size

    # 初始化数据库
    db_handler = MySQLDatabaseHandler(
        host=mysql_host,
        port=mysql_port,
        database=mysql_db,
        user=mysql_username,
        password=mysql_password,
        pool_size=mysql_pool_size
    )

    return db_handler


