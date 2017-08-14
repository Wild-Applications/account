docker build -t blueapp/account:0.0.2 . &&
kubectl scale --replicas=0 deployment deployment --namespace=account &&
kubectl scale --replicas=2 deployment deployment --namespace=account
